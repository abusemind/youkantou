chrome.runtime.onInstalled.addListener(() => {
	chrome.action.setBadgeText({
		text: "ON",
	});

	chrome.action.setBadgeBackgroundColor(
		{ color: 'green' }
	);
});


var cache = {};
chrome.action.onClicked.addListener(async (tab) => {
	if (tab.url.startsWith('https://youkantou.emoney.cn/jinNang')) {

		var jinNangId = tab.url.substring(tab.url.lastIndexOf('/') + 1);

		//showCurrentRepo(jinNangId);
		//showRecentTrades(jinNangId, true);

	}

	chrome.notifications.getAll((notifications) => {
		if (notifications) {
			for (let notificationId in notifications) {
				chrome.notifications.clear(notificationId);
			}
		}
	});


	var notificationEnabled = await chrome.action.getBadgeText(
		{}
	);
	notificationEnabled = notificationEnabled === "ON" ? "OFF" : "ON";
	chrome.action.setBadgeText({
		text: notificationEnabled,
	});
	let notificationActionBGColor = notificationEnabled === "ON" ? "green" : "orange";
	chrome.action.setBadgeBackgroundColor(
		{ color: notificationActionBGColor }
	);
});

chrome.contextMenus.create({
	title: "开始监测",
	contexts: ["action"],
	id: 'startJinNang'
});

chrome.contextMenus.create({
	title: "今日交易",
	contexts: ["action"],
	id: 'todayTrade'
});

chrome.contextMenus.create({
	title: "最近交易",
	contexts: ["action"],
	id: 'recentTrade'
});

chrome.contextMenus.create({
	title: "持仓情况",
	contexts: ["action"],
	id: 'currentRepo'
});

chrome.contextMenus.create({
	title: "持仓情况 (打开雪球)",
	contexts: ["action"],
	id: 'currentRepoXueqiu'
});


chrome.contextMenus.onClicked.addListener(function (info, tab) {

	if (info.menuItemId == 'startJinNang') {
		startExtensionMonitoring();
	} else if (tab.url.startsWith('https://youkantou.emoney.cn/jinNang')) {
		var jinNangId = tab.url.substring(tab.url.lastIndexOf('/') + 1);
		if (info.menuItemId == 'todayTrade') {
			showRecentTrades(jinNangId, true);
		} else if (info.menuItemId == 'recentTrade') {
			showRecentTrades(jinNangId, false);
		} else if (info.menuItemId == 'currentRepo') {
			showCurrentRepo(jinNangId, false);
		} else if (info.menuItemId == 'currentRepoXueqiu') {
			showCurrentRepo(jinNangId, true);
		}
	}
});

async function startExtensionMonitoring() {
	const myJinNang = [
		"2011624355",  //蔡玲玲 1
		"2011840981",  //蔡玲玲 2
		"2011624335",  //吴俊琛
		"2011624512",  //周铮
		"2013816237"   //祝超
	];

	for (const jnID of myJinNang) {
		const url = "https://youkantou.emoney.cn/jinNang/" + jnID;
		chrome.tabs.create({
			active: false,
			url: url
		});
	}

	var xueqiu = "https://xueqiu.com/";
	chrome.tabs.create({
		active: true,
		url: xueqiu
	});
}

async function showCurrentRepo(jinNangId, openInXueqiu) {
	const result = await chrome.storage.local.get(['RepoArray']);
	if (!result) {
		return;
	}
	var repoArray = result['RepoArray'];
	var foundRepo = false;
	const cacheJN = cache[jinNangId];
	const title = cacheJN ? cacheJN : "锦囊 " + jinNangId;
	for (const detail of repoArray) {
		if (detail['jinNangId'] == jinNangId) {
			foundRepo = true;
			var items = detail['items'];

			for (const stock of items) {
				if (stock.secuScale > 0) {
					var stockString = String(stock.stockId);

					stockString = stockString.length > 6 ? stockString.slice(-6) : stockString;
					var info = await fetchStockInfo(stockString);

					var message = (info == null) ? stockString : info.name + " (" + info.code + ")";
					var notificationEnabled = await chrome.action.getBadgeText({});
					if (notificationEnabled === "ON") {

						if (!openInXueqiu) {
							chrome.notifications.create('', {
								type: 'progress',
								iconUrl: 'images/icon-256.png',
								title: message,
								message: "持仓盈亏: " + (stock.gainLossScale.startsWith('-') ? stock.gainLossScale : ("+" + stock.gainLossScale)),
								contextMessage: info ? info.ind_name : '行业',
								priority: 2,
								progress: parseInt(stock.secuScale / 100)
							});
						}


						//open the stock page in Xueqiu website
						if (info != null && openInXueqiu) {
							const code = info.code;
							const url = 'https://xueqiu.com/' + code.charAt(0) + '/' + code;
							chrome.tabs.create({
								active: true,
								url: url
							});
						}
					}
				}
			}
		}
	}
	if (false == foundRepo) {
		var notificationEnabled = await chrome.action.getBadgeText({});
		if (notificationEnabled === "ON") {
			chrome.notifications.create('', {
				type: 'basic',
				iconUrl: 'images/icon-256.png',
				title: 'Warning',
				message: 'No RepoList found for ' + title,
				priority: 0
			});
		}
	}
}

async function showRecentTrades(jinNangId, onlyToday) {
	const result = await chrome.storage.local.get(['TradeArray']);
	if (!result) {
		console.log('no TradeArray found');
		return;
	}
	var TradeArray = result['TradeArray'];
	//const cacheJN = cache[jinNangId];
	//const title = cacheJN ? cacheJN : "锦囊 " + jinNangId;
	//console.log(JSON.stringify(TradeArray));

	for (const ele of TradeArray) {
		if (ele['jinNangId'] == jinNangId) {
			var items = ele['detail'].list;
			const now = new Date();
			// JavaScript only outputs ISO format as UTC,
			//   so a timezone adjust trick is needed.
			const todayIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().substr(0, 10);
			const startOfDay = new Date(todayIso + 'T00:00');
			const lastCheck = onlyToday ? startOfDay.getTime() : 0;
			items = sortTrades(items);
			for (const trade of items) {
				if (trade.tradeTime > lastCheck) {
					//console.log(trade.tradeTime);
					var stockString = String(trade.stockId);
					stockString = stockString.length > 6 ? stockString.slice(-6) : stockString;
					var info = await fetchStockInfo(stockString);
					var stockTitle = (info == null) ? stockString : info.name + " (" + info.code + ": " + info.ind_name + ")";
					var title = trade.authorName + " " + trade.tradeTypeName + " " + stockTitle;
					var message = "¥" + trade.entrustPrice / 10000 + (trade.tradeTypeName == '卖出' ? "        盈亏: " + trade.plScale : "");

					var notificationEnabled = await chrome.action.getBadgeText({});
					if (notificationEnabled === "ON") {
						chrome.notifications.create('', {
							type: 'basic',
							iconUrl: 'images/' + trade.tradeTypeName + '.png',
							title: title,
							message: message,
							contextMessage: trade.title + " " + prettyDate2(trade.tradeTime),
							eventTime: trade.tradeTime,
							priority: 2
						});

						if (onlyToday) {
							//open the stock page in Xueqiu website
							if (info != null && info.code != null) {
								const code = info.code;
								const url = 'https://xueqiu.com/' + code.charAt(0) + '/' + code;
								chrome.tabs.create({
									active: true,
									url: url
								});
							}
						}
					}
				}
			}

		}
	}
}

async function handleRepoList(repoData, jinNangId) {
	if (!repoData || !jinNangId)
		return;
	//newly fetched repoList
	var detail = repoData.detail;
	detail['jinNangId'] = jinNangId;

	const result = await chrome.storage.local.get(['RepoArray']);
	var oldRepoArray = result["RepoArray"];
	if (!oldRepoArray)
		oldRepoArray = [];
	var newRepoArray = [];
	for (const repo of oldRepoArray) {
		if (repo['jinNangId'] != jinNangId) {
			newRepoArray.push(repo);
		}
	}
	newRepoArray.push(detail);

	chrome.storage.local.set({
		"RepoArray": newRepoArray
	});
}

async function handleTradePage(tradeData, jinNang) {
	//store recent trade data with jinNang Id mapping
	if (jinNang && tradeData) {
		//console.log("handleTradePage " + jinNang);
		tradeData["jinNangId"] = jinNang;
		const result = await chrome.storage.local.get(['TradeArray']);
		var oldTradeArray = result["TradeArray"];
		if (!oldTradeArray)
			oldTradeArray = [];
		var newTradeArray = [];
		for (const trade of oldTradeArray) {
			if (trade['jinNangId'] != jinNang) {
				newTradeArray.push(trade);
			}
		}
		newTradeArray.push(tradeData);
		chrome.storage.local.set({
			"TradeArray": newTradeArray
		});
	}

	//notify new trades since last check time
	var items = tradeData.detail.list;
	chrome.storage.local.get(["lastTradePageCheckTime"]).then(async (result) => {
		var lastCheck = result.lastTradePageCheckTime;
		//console.log('last check: ' + lastCheck);
		if (!lastCheck) {
			const thisCheck = Date.now();
			chrome.storage.local.set({ "lastTradePageCheckTime": thisCheck });
			var statusMsg = "Found " + items.length + " trades at " + thisCheck;
			console.log(statusMsg);
		} else {
			if (items.length > 0) {
				var firstTrade = items[0];
				//console.log(firstTrade.title + ' - 最新股票买卖 After: ' + lastCheck + " by " + firstTrade.authorName);
			}
			items = sortTrades(items);
			for (const trade of items) {
				if (trade.tradeTime > lastCheck) {
					//console.log(trade.tradeTime);
					var stockString = String(trade.stockId);
					stockString = stockString.length > 6 ? stockString.slice(-6) : stockString;
					var info = await fetchStockInfo(stockString);
					var stockTitle = (info == null) ? stockString : info.name + " (" + info.code + ": " + info.ind_name + ")";
					var title = trade.authorName + " " + trade.tradeTypeName + " " + stockTitle;
					var message = "¥" + trade.entrustPrice / 10000 + (trade.tradeTypeName == '卖出' ? "        盈亏: " + trade.plScale : "");

					var notificationEnabled = await chrome.action.getBadgeText({});
					if (notificationEnabled === "ON") {
						chrome.notifications.create(tradeNotificationId(trade, info), {
							type: 'basic',
							iconUrl: 'images/' + trade.tradeTypeName + '.png',
							title: title,
							message: message,
							contextMessage: trade.title + " " + prettyDate2(trade.tradeTime),
							eventTime: trade.tradeTime,
							priority: 1
						});

						//open the stock page in Xueqiu website
						if (info != null && info.code != null) {
							const code = info.code;
							const url = 'https://xueqiu.com/' + code.charAt(0) + '/' + code;
							chrome.tabs.create({
								active: true,
								url: url
							});
						}
					}
				}
				//store JinNang information for repoList reference
				cache[trade.jinNangId] = trade.authorName + "的" + trade.title;
			}
			var thisCheck = tradeData.result.updateTime;
			chrome.storage.local.set({ "lastTradePageCheckTime": thisCheck });
		}
	});
}

chrome.notifications.onClicked.addListener(
	//simply dismiss the notification on click
	function (notificationId) {
		if (notificationId.startsWith('trade')) {
			const arrayTradeInfo = notificationId.split('$$');
			if (arrayTradeInfo.length == 4) {
				const code = arrayTradeInfo[3];
				const url = 'https://xueqiu.com/' + code.charAt(0) + '/' + code;
				chrome.tabs.create({
					active: true,
					url: url
				});
			}
		}
		chrome.notifications.clear(notificationId);
	}
)

chrome.runtime.onMessage.addListener(
	function (message) {
		if (message.type === "RepoList") {
			var repoData = JSON.parse(message.data);
			if (repoData) {
				handleRepoList(repoData, message.jinNangId);
			}
		}
		else if (message.type === "TradePage") {
			var tradeData = JSON.parse(message.data);
			if (tradeData) {
				handleTradePage(tradeData, message.jinNangId);
			}
		}
	}
);

chrome.alarms.create('reloadPage', {
	delayInMinutes: 0,
	periodInMinutes: 1,
});


chrome.alarms.onAlarm.addListener(async (alarm) => {
	//console.log('alamrs fired');
	if (alarm.name == 'reloadPage') {

		var notificationEnabled = await chrome.action.getBadgeText(
			{}
		);

		if (notificationEnabled === 'OFF') {
			return;
		}

		const currentDate = new Date();

		(async () => {
			const tabs = await chrome.tabs.query({
				url: [
					"https://youkantou.emoney.cn/jinNang/*"
				],
			});

			for (const tab of tabs) {
				chrome.tabs.reload(tab.id);
			}
		})();

	}
});


var cache = {};
async function fetchStockInfo(code) {
	var url = 'https://xueqiu.com/query/v1/search/stock.json?size=1&code=' + code;
	//console.log('load stock with url: ' + url);
	var response = await fetch(url);
	var text = await response.text();
	//console.log(text);
	var info = JSON.parse(text);
	if (info.size > 0 && info.stocks.length > 0) {
		const stock = info.stocks[0];
		//console.log(stock.code + " " + stock.name + " " + stock.ind_name);
		return stock;
	}
	return null;
}

//YouKanTou Utils

function tradeNotificationId(trade, info) {
	if (info == null)
		return '';
	else
		return "trade" + trade.tradeTypeName + "$$" + trade.title + "$$" + trade.tradeTime + "$$" + info.code;
}

function sortTrades(trades) {
	return trades.sort(function (a, b) {
		return a.tradeTime - b.tradeTime;
	});
}

//utils
function prettyDate2(time) {
	var date = new Date(parseInt(time));
	return date.toLocaleTimeString(navigator.language, {
		hour: '2-digit',
		minute: '2-digit'
	});
}

