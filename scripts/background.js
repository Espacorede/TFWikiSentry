let expressions, languageExpressions, menus, options, tbrowser, translationExpressions;

const languages = [
    "en", "ar", "cs", "da",
    "de", "es", "fi", "fr",
    "hu", "it", "ja", "ko",
    "nl", "no", "pl", "pt",
    "pt-br", "ro", "ru", "tr",
    "zh-hans", "zh-hant"];

if (chrome) {
    tbrowser = chrome;
    menus = tbrowser.contextMenus;
} else {
    tbrowser = browser;
    menus = tbrowser.menus;
}

function setOptions() {
    loadOptions().then(val => {
        options = val;
        initializeExpressions();
    });
}

setOptions();

function connectPort(port) {
    if (port.name === "options-port") {
        port.onMessage.addListener(() => {
            setOptions();
        });
        return;
    }
    if (port.name === "wiki-port") {
        port.onMessage.addListener(msg => {
            port.postMessage({
                warnings: executeExpressions(msg.text, msg.language)
            });
        });
        return;
    }
}

tbrowser.runtime.onConnect.addListener(connectPort);

function loadOptions() {
    return new Promise((resolve) => {
        tbrowser.storage.sync.get(null, value => {
            resolve(value);
        });
    });
}

function initializeExpressions() {
    expressions = [];
    translationExpressions = [];
    languageExpressions = {};

    loadExpressions();
}

function loadExpressions() {
    const rulesGeneral = tbrowser.runtime.getURL("rules/rules.json");
    const rulesGeneric = tbrowser.runtime.getURL("rules/rules-language.json");

    loadJsonFromUrl(rulesGeneral).then((json, err) => {
        if (err) {
            throw err;
        }
        expressions = getActiveRules(json);
    });
    loadJsonFromUrl(rulesGeneric).then((json, err) => {
        if (err) {
            throw err;
        }
        translationExpressions = getActiveRules(json);
    });

    for (const lang of languages) {
        const rulesLanguage = tbrowser.runtime.getURL(`rules/rules-${lang}.json`);
        loadJsonFromUrl(rulesLanguage).then((json, err) => {
            if (err) {
                throw err;
            }
            languageExpressions[lang] = getActiveRules(json);
        });
    }
}

function getActiveRules(json) {
    const loaded = [];

    if (json && json.rules) {
        for (const rule in json.rules) {
            if (options[rule] === false) {
                continue;
            }
            loaded.push(json.rules[rule]);
        }

        return loaded;
    } else {
        throw "tf-wiki-sentry - Error loading rules: Malformed or missing JSON.";
    }
}


function loadJsonFromUrl(url) {
    return new Promise((resolve, reject) => {
        const http = new XMLHttpRequest();

        http.onreadystatechange = () => {
            if (http.readyState === 4) {
                if (http.status === 200) {
                    const json = JSON.parse(http.responseText);
                    resolve(json);
                } else {
                    reject(http.responseText);
                }
            }
        };

        http.open("GET", url, true);
        http.send();
    });
}

function executeExpressions(text, lang) {
    const warnings = [];

    for (const expression of expressions) {
        warnings.push(...executeExpression(expression, text));
    }
    if (lang !== "en") {
        for (const expression of translationExpressions) {
            warnings.push(...executeExpression(expression, text));
        }
    }
    const languageSpecific = languageExpressions[lang];
    if (languageSpecific) {
        for (const expression of languageSpecific) {
            warnings.push(...executeExpression(expression, text));
        }
    }

    warnings.sort((a, b) => {
        if (a.lineIndex < b.lineIndex ||
            (a.lineIndex === b.lineIndex && a.lineStartIndex < b.lineStartIndex)) {
            return -1;
        } else if (a.lineIndex > b.lineIndex ||
            (a.lineIndex === b.lineIndex && a.lineStartIndex > b.lineStartIndex)) {
            return 1;
        }
        return 0;
    });

    return warnings;
}

function executeExpression(expression, text) {
    const lines = text.split("\n").map((line) => line.length + 1);

    const exp = new RegExp(expression.expression, expression.flags);
    let match = exp.exec(text);
    const warnings = [];

    while (match !== null) {
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;

        let lineIndex = 0;
        let lineCharacterSum = 0;

        while (lineCharacterSum + lines[lineIndex] <= startIndex) {
            lineCharacterSum += lines[lineIndex];
            lineIndex += 1;
        }

        const lineCharacterIndex = startIndex - lineCharacterSum;

        warnings.push({
            reason: expression.reason,
            text: match[0],
            textStartIndex: startIndex,
            textEndIndex: endIndex,
            lineIndex: lineIndex + 1,
            lineStartIndex: lineCharacterIndex
        });

        match = exp.exec(text);
    }
    return warnings;
}


tbrowser.tabs.onActivated.addListener(async (tab) => {
    if (tbrowser.contextMenus) {
        menus = tbrowser.contextMenus;
    } else {
        menus = tbrowser.menus;
    }
    await tbrowser.tabs.get(tab.tabId, async (tabInfo) => {
        if (tabInfo.url.startsWith("https://wiki.teamfortress.com")) {
            menus.removeAll(function () {
                menus.create({
                    id: "tf-wiki-sentry-url",
                    title: "Copy shortened URL (wiki.tf)",
                    contexts: ["page"]
                });
            });
        } else {
            menus.removeAll();
        }
    });

    menus.onClicked.addListener((data, tab) => {
        if (data.menuItemId === "tf-wiki-sentry-url") {
            const url = new URL(tab.url).searchParams;
            const title = url.get("title") || tab.url.split(/\/(w|wiki)\//)[2];
            const diff = url.get("diff");
            let url_wiki;

            if (diff) {
                url_wiki = `https://wiki.tf/d/${diff}`;
            } else {
                url_wiki = `https://wiki.tf/${title}`;
            }

            navigator.clipboard.writeText(url_wiki).catch((rejected) => {
                console.log(`tf-wiki-sentry - Failed to paste to clipboard using clipboardApi (${rejected}). Using execCommand instead.`);

                const dummy = document.createElement("input");
                document.body.appendChild(dummy);
                dummy.setAttribute("value", url_wiki);
                dummy.select();
                document.execCommand("copy");
                document.body.removeChild(dummy);
            });
        }
    });
});