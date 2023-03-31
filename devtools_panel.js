chrome.devtools.network.onRequestFinished.addListener(request => {
    request.getContent((body) => {

        if (request.request && request.request.url) {
            if (request.request.url.includes('https://yktapi.emoney.cn/JinNang/Data/RepoList')) {
                if (!request.request.postData)
                    return;
                var postData = JSON.parse(request.request.postData.text);
                var jinNang = postData['jinNangId'];
                chrome.runtime.sendMessage({
                    data: body,
                    type: 'RepoList',
                    jinNangId: jinNang
                });
            } else if (request.request.url.includes('https://yktapi.emoney.cn/JinNang/Data/TradePage')) {
                if (!request.request.postData)
                    return;
                var postData = JSON.parse(request.request.postData.text);
                var jinNang = postData['jinNangId'];
                chrome.runtime.sendMessage({
                    data: body,
                    type: 'TradePage',
                    jinNangId: jinNang
                });
            }
        }
    });
});


