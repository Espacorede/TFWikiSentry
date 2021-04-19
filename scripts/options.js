let tbrowser;

if (chrome) {
    tbrowser = chrome;
} else {
    tbrowser = browser;
}

const languages = ["ar", "cs", "da", "de",
    "es", "fi", "fr", "hu",
    "it", "ja", "ko", "nl",
    "no", "pl", "pt", "pt-br",
    "ro", "ru", "tr", "zh-hans",
    "zh-hant"];

let selectedLanguage;

const bgPort = tbrowser.runtime.connect({
    name: "options-port"
});

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

document.addEventListener("DOMContentLoaded", function () {
    // load rules from json
    const rulesGeneral = "https://raw.githubusercontent.com/Espacorede/TFWikiSentry/rules/rules.json";

    loadRules(rulesGeneral, "general-rules");
    let languagePromise = loadRules("https://raw.githubusercontent.com/Espacorede/TFWikiSentry/rules/rules-en.json", "en");
    for (const lang of languages) {
        const rulesLanguage = `https://raw.githubusercontent.com/Espacorede/TFWikiSentry/rules/rules-${lang}.json`;
        languagePromise = languagePromise.then(loadRules(rulesLanguage, lang));
    }

    languagePromise.then(() => {
        const select = document.getElementById("language-select");
        select.onchange = loadLanguageOptions;

        // "Save settings" button
        document.getElementById("save").addEventListener("click", function () {
            saveOptions();
        });

        // Language dropdown
        document.getElementById("language-select").addEventListener("change", function () {
            loadLanguageOptions();
        });

        // Load current settings
        loadOptions();
        loadLanguageOptions();
        gettbrowserLanguage();
    });
});

function loadRules(url, section) {
    return new Promise((resolve, reject) => {
        loadJsonFromUrl(url).then(json => {
            if (json && json.rules) {
                if (json.language) {
                    addLanguage(section, json.language);
                }
                const rules = json.rules;

                const container = document.getElementById(section);
                for (const rule in rules) {
                    container.appendChild(createRuleOption(rule, rules[rule]));
                }
                resolve();
            } else {
                reject("tf-wiki-sentry - Error loading rules: Malformed JSON.");
            }
        }, err => {
            reject(`tf-wiki-sentry - Error loading ${section} rules: ${err}`);
        });
    });
}

function addLanguage(code, prettyName) {
    const option = document.createElement("option");
    option.value = code;
    option.id = `${code}-option`;
    option.innerText = prettyName;
    document.getElementById("language-select").appendChild(option);

    const div = document.createElement("div");
    div.id = code;
    div.classList.add("language-div");

    document.getElementById("language").appendChild(div);
}

function createRuleOption(name, rule) {
    const p = document.createElement("p");

    const label = document.createElement("label");
    label.setAttribute("for", name);
    label.innerText = rule.reason;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    input.id = name;
    input.name = name;

    p.appendChild(label);
    p.appendChild(input);

    return p;
}

if (chrome) {
    tbrowser = chrome;
}

function saveOptions() {
    document.getElementById("note").className = "";

    const checkBoxes = document.querySelectorAll("input");
    const options = {};

    for (const checkbox of checkBoxes) {
        options[checkbox.id] = checkbox.checked;
    }

    tbrowser.storage.sync.set(options, function () {
        document.getElementById("note").innerText = "Settings saved, yo.";
        document.getElementById("note").className = "success";
    }).then(() => {
        bgPort.postMessage({
            update: true
        });
    });
}

function loadLanguageOptions() {
    const lang = document.getElementById("language-select").value;
    tbrowser.storage.sync.set({
        "options-language": lang
    });
    if (lang) {
        for (const el of document.getElementsByClassName("active")) {
            el.classList.remove("active");
        }

        document.getElementById(lang).classList.add("active");
    }
}

function gettbrowserLanguage() {
    const tbrowserLanguage = selectedLanguage || navigator.language;
    const lowercaseLanguage = tbrowserLanguage.toLowerCase();
    const select = document.getElementById("language-select");
    let wikiLanguage;

    if (lowercaseLanguage === "pt-br") {
        wikiLanguage = "pt-br";
    } else if (lowercaseLanguage.startsWith("zh")) {
        wikiLanguage = lowercaseLanguage.endsWith("cn") || lowercaseLanguage.endsWith("sg") ? "zh-hans" : "zh-hant";
    } else {
        wikiLanguage = lowercaseLanguage.split("-")[0];
    }

    const selectElement = document.getElementById("language-select");
    let index = selectElement.options.findIndex(opt => opt.value === wikiLanguage);
    if (index === -1) {
        index = 0;
    }
    selectElement.selectedIndex = index;

    document.getElementById(select.value).classList.add("active");
}

function loadOptions() {
    tbrowser.storage.sync.get(null, function (saved) {
        if (saved) {
            selectedLanguage = saved["options-language"];
            const checkBoxes = document.querySelectorAll("input");

            for (const checkbox of checkBoxes) {
                if (saved[checkbox.id] === false) {
                    checkbox.checked = false;
                }
            }
        }
    });
}