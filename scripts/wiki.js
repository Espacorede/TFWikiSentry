let bgPort, warningsContainer, feedbackContainer;
const editorTextBox = document.getElementById("wpTextbox1");
const langExp = /\/([at]r|[ce]s|d[ae]|f[ir]|hu|it|ja|ko|n[lo]|p(?:l|t(?:-br)?)|r[ou]|sv|zh-han[st])/;
let pageTitle = window.location.pathname.split("/").pop();

let update = true;
let lastChange = new Date();

if (chrome) {
    browser = chrome;
}

if (pageTitle === "index.php") {
    const url = new URL(window.location.href);
    const title = url.searchParams.get("title");

    if (title) {
        pageTitle = title;
    }
}

const languageSuffix = langExp.exec(pageTitle);
const languageCode = languageSuffix ? languageSuffix[1] : "en";

if (editorTextBox && !pageTitle.match("(?:Template(?:(?: |_)?talk)?|Module(?:(?: |_)?talk)?|User(?:(?: |_)?talk)?|Talk|File(?:(?: |_)?talk)?|Help(?:(?: |_)?talk)?|Category(?: |_)talk|Team(?: |_)Fortress(?: |_)Wiki(?:(?: |_)?talk)?):")) {
    createWarnings();

    bgPort = browser.runtime.connect({
        name: "wiki-port"
    });

    bgPort.onMessage.addListener(msg => {
        if (msg.warnings && msg.warnings.length > 0) {
            feedbackContainer.innerText = "";
            for (const warning of msg.warnings) {
                addWarning(warning.reason, warning.text, warning.textStartIndex,
                    warning.textEndIndex, warning.lineIndex, warning.lineStartIndex);
            }
        }
        else {
            feedbackContainer.innerText = "Nothing of note found in this text.";
        }
    });

    browser.storage.sync.get(null, value => {
        if (value["manual-check"]) {
            editorTextBox.oninput = onTextboxChange;
            editorTextBox.onfocusout = checkText;
            checkText();
            setInterval(() => {
                if (update && ((new Date() - lastChange) / 1000) > 1.0) {
                    update = false;
                    checkText();
                }
            }, 1000);
        } else {
            generateButton();
        }
    });

    console.log("WikiSentry loaded");
}

function createWarnings() {
    let basePosition = document.getElementById("editpage-copywarn");
    let baseIndex = -1;

    while (basePosition.previousSibling !== null) {
        baseIndex += 1;
        basePosition = basePosition.previousSibling;
    }

    const parentElement = basePosition.parentElement;

    const enhancer = document.createElement("div");
    enhancer.textContent = "Wiki Sentry";
    enhancer.id = "tf-wiki-sentry";
    enhancer.style = "padding: 10px;font-weight: bold;background-color:#dedede; margin-left: 0.5em; margin-right: 7em;border-radius:1%";

    const warningsElement = document.createElement("div");
    warningsElement.id = "sentry-warnings";
    warningsElement.style = "color: #c00;max-height: 10rem;overflow: auto;";

    const feedbackElement = document.createElement("span");
    feedbackElement.id = "sentry-note";
    feedbackElement.style = "color: #2b2b2b";

    enhancer.appendChild(warningsElement);
    enhancer.appendChild(feedbackElement);

    parentElement.insertBefore(enhancer, parentElement.childNodes[baseIndex]);

    warningsContainer = warningsElement;
    feedbackContainer = feedbackElement;
}

function onTextboxChange() {
    update = true;
    lastChange = new Date();
}

function checkText() {
    feedbackContainer.innerText = "Verifying...";
    const editingText = editorTextBox.value;

    warningsContainer.innerHTML = "";

    try {
        bgPort.postMessage({
            text: editingText,
            language: languageCode
        });
    } catch (ex) {
        feedbackContainer.innerText = ex;
        console.error(`tf-wiki-sentry - ${ex}`);

    }
}


function addWarning(message, highlight, selectStart, selectEnd, lineIndex, lineCharacterIndex) {
    const span = document.createElement("span");
    span.innerText = `[Line ${lineIndex} character ${lineCharacterIndex}] Warning: ${message} (${highlight})`;

    warningsContainer.appendChild(span);

    span.onclick = function () {
        editorTextBox.scrollIntoView();
        editorTextBox.focus();
        editorTextBox.setSelectionRange(selectStart, selectEnd);
    };

    span.style.cursor = "pointer";

    warningsContainer.appendChild(document.createElement("br"));
}

function generateButton() {
    const button = document.createElement("div");
    button.innerText = "Verify text";
    button.style = "-webkit-appearance: button;-moz-appearance: button;appearance: button;text-rendering: auto;color: #000;display: inline-block;cursor: default;font: 400 13.3333px Arial;padding: 1px 6px;border-width: 2px;border-style: outset;margin-top: 5px;cursor: pointer;font-weight: bold;background-color: #ccc";

    document.getElementById("tf-wiki-sentry").appendChild(button);

    button.onclick = checkText;
}