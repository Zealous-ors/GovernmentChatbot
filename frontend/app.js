const STORAGE_KEY = "governmentChats";
const THEME_KEY = "governmentTheme";

let chats = [];
let currentChatId = null;
let isWaiting = false;

/* =========================================================
DOM ELEMENTS
========================================================= */

const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

const openSidebar = document.getElementById("openSidebar");
const closeSidebar = document.getElementById("closeSidebar");

const newChatButton = document.getElementById("newChat");

const chatHistory = document.getElementById("chatHistory");
const historyCount = document.getElementById("historyCount");

const clearHistoryButton = document.getElementById("clearHistory");

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeText = document.getElementById("themeText");

const mainArea = document.getElementById("mainArea");

const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

/* =========================================================
SVG ICONS
========================================================= */

const icons = {
chat: `         <svg viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">             <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5H7l-4 3v-6.5A7.5 7.5 0 1 1 20 11.5Z"/>         </svg>
    `,

```
delete: `
    <svg viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7h16"/>
        <path d="M10 11v6"/>
        <path d="M14 11v6"/>
        <path d="M6 7l1 13h10l1-13"/>
        <path d="M9 7V4h6v3"/>
    </svg>
`,

moon: `
    <svg viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5
                 A8.5 8.5 0 1 0 20.5 14.5Z"/>
    </svg>
`,

sun: `
    <svg viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2"/>
        <path d="M12 20v2"/>
        <path d="m4.93 4.93 1.41 1.41"/>
        <path d="m17.66 17.66 1.41 1.41"/>
        <path d="M2 12h2"/>
        <path d="M20 12h2"/>
        <path d="m4.93 19.07 1.41-1.41"/>
        <path d="m17.66 6.34 1.41-1.41"/>
    </svg>
`,

send: `
    <svg viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
        <path d="m22 2-7 20-4-9-9-4Z"/>
        <path d="M22 2 11 13"/>
    </svg>
`
```

};

/* =========================================================
INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

```
loadChats();

loadTheme();

renderHistory();

if (chats.length > 0) {
    currentChatId = chats[0].id;
    renderCurrentChat();
} else {
    createNewChat(false);
}

updateThemeUI();

setupEvents();

messageInput.focus();
```

});

/* =========================================================
EVENT LISTENERS
========================================================= */

function setupEvents() {

```
chatForm.addEventListener("submit", handleSubmit);

messageInput.addEventListener("keydown", handleInputKeydown);

newChatButton.addEventListener("click", () => {
    createNewChat(true);
    closeMobileSidebar();
});

clearHistoryButton.addEventListener("click", clearAllChats);

themeToggle.addEventListener("click", toggleTheme);

openSidebar.addEventListener("click", openMobileSidebar);

closeSidebar.addEventListener("click", closeMobileSidebar);

if (sidebarOverlay) {
    sidebarOverlay.addEventListener(
        "click",
        closeMobileSidebar
    );
}

/*
 * Service suggestion cards
 *
 * Example:
 *
 * <button class="service-card"
 *         data-message="Tell me about NIDA registration.">
 */

document.addEventListener("click", (event) => {

    const serviceCard =
        event.target.closest(".service-card");

    if (!serviceCard) {
        return;
    }

    const message =
        serviceCard.dataset.message;

    if (!message) {
        return;
    }

    messageInput.value = message;

    handleSubmit(event);
});
```

}

/* =========================================================
CHAT SUBMISSION
========================================================= */

async function handleSubmit(event) {

```
event.preventDefault();

if (isWaiting) {
    return;
}

const message =
    messageInput.value.trim();

if (!message) {
    return;
}

const chat =
    getCurrentChat();

if (!chat) {
    return;
}

/*
 * Save the conversation BEFORE sending the request.
 *
 * The backend receives previous conversation messages
 * so it can understand follow-up questions.
 */

const conversationHistory =
    chat.messages.map(item => ({
        role: item.role,
        content: item.content
    }));

addMessage(
    "user",
    message
);

messageInput.value = "";

showTyping();

setWaiting(true);

try {

    const response =
        await fetch("/chat", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message: message,
                history: conversationHistory
            })
        });

    if (!response.ok) {

        throw new Error(
            `Server returned ${response.status}`
        );
    }

    const data =
        await response.json();

    hideTyping();

    const answer =
        data.response ||
        data.answer ||
        "Sorry, I could not generate a response.";

    addMessage(
        "bot",
        answer
    );

} catch (error) {

    console.error(
        "Chat error:",
        error
    );

    hideTyping();

    addMessage(
        "bot",
        "Sorry, I could not connect to the Government Services AI right now. Please check that the backend server is running and try again."
    );

} finally {

    setWaiting(false);

    messageInput.focus();
}
```

}

/* =========================================================
INPUT KEYBOARD
========================================================= */

function handleInputKeydown(event) {

```
if (
    event.key === "Enter" &&
    !event.shiftKey
) {
    event.preventDefault();

    chatForm.requestSubmit();
}
```

}

/* =========================================================
ADD MESSAGE
========================================================= */

function addMessage(
role,
content
) {

```
const chat =
    getCurrentChat();

if (!chat) {
    return;
}

chat.messages.push({
    role: role,
    content: content,
    timestamp: Date.now()
});

chat.updatedAt =
    Date.now();

/*
 * If this is the first user message,
 * automatically create a useful title.
 */

if (
    role === "user" &&
    chat.title === "New Conversation"
) {
    chat.title =
        createChatTitle(content);
}

saveChats();

renderCurrentChat();

renderHistory();
```

}

/* =========================================================
CREATE CHAT TITLE
========================================================= */

function createChatTitle(message) {

```
let title =
    message.trim();

if (!title) {
    return "New Conversation";
}

/*
 * Keep history titles short.
 */

if (title.length > 42) {
    title =
        title.substring(0, 42).trim() +
        "...";
}

return title;
```

}

/* =========================================================
CREATE NEW CHAT
========================================================= */

function createNewChat(
shouldRender = true
) {

```
const newChat = {
    id:
        generateId(),

    title:
        "New Conversation",

    messages:
        [],

    createdAt:
        Date.now(),

    updatedAt:
        Date.now()
};

chats.unshift(newChat);

currentChatId =
    newChat.id;

saveChats();

if (shouldRender) {
    renderCurrentChat();
    renderHistory();

    messageInput.focus();
}
```

}

/* =========================================================
GET CURRENT CHAT
========================================================= */

function getCurrentChat() {

```
return chats.find(
    chat =>
        chat.id === currentChatId
);
```

}

/* =========================================================
SWITCH CHAT
========================================================= */

function switchChat(chatId) {

```
if (isWaiting) {
    return;
}

const exists =
    chats.some(
        chat =>
            chat.id === chatId
    );

if (!exists) {
    return;
}

currentChatId =
    chatId;

saveChats();

renderHistory();

renderCurrentChat();

closeMobileSidebar();

messageInput.focus();
```

}

/* =========================================================
RENDER CURRENT CHAT
========================================================= */

function renderCurrentChat() {

```
const chat =
    getCurrentChat();

if (!chat) {
    renderWelcome();
    return;
}

chatBox.innerHTML = "";

if (
    !chat.messages ||
    chat.messages.length === 0
) {

    renderWelcome();

    return;
}

chat.messages.forEach(
    message => {

        renderMessage(
            message.role,
            message.content
        );
    }
);

scrollToBottom(false);
```

}

/* =========================================================
WELCOME SCREEN
========================================================= */

function renderWelcome() {

```
chatBox.innerHTML = `

    <div class="welcome-message">

        <div class="welcome-icon">

            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M12 3l8 4v5c0 5-3.5 8-8 9
                         -4.5-1-8-4-8-9V7l8-4Z"/>

                <path d="M9 12l2 2 4-4"/>
            </svg>

        </div>

        <h2>
            How can I help you?
        </h2>

        <p>
            Ask me about Tanzanian government
            services such as NIDA, passports,
            TIN, driving licences, birth
            certificates and land services.
        </p>

    </div>

    <div class="service-suggestions">

        <button
            type="button"
            class="service-card"
            data-message="Tell me about NIDA registration."
        >

            <div class="service-icon">

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <rect
                        x="4"
                        y="3"
                        width="16"
                        height="18"
                        rx="2"
                    />

                    <circle
                        cx="9"
                        cy="9"
                        r="2"
                    />

                    <path d="M13 8h4"/>
                    <path d="M13 11h4"/>
                    <path d="M7 15h10"/>
                    <path d="M7 18h7"/>
                </svg>

            </div>

            <div class="service-content">

                <h3>NIDA</h3>

                <p>
                    National identification services
                </p>

            </div>

        </button>


        <button
            type="button"
            class="service-card"
            data-message="Tell me about getting a Tanzanian passport."
        >

            <div class="service-icon blue">

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <rect
                        x="5"
                        y="3"
                        width="14"
                        height="18"
                        rx="2"
                    />

                    <circle
                        cx="12"
                        cy="10"
                        r="3"
                    />

                    <path d="M8 17h8"/>
                </svg>

            </div>

            <div class="service-content">

                <h3>Passport</h3>

                <p>
                    Passport and travel documents
                </p>

            </div>

        </button>


        <button
            type="button"
            class="service-card"
            data-message="Tell me about getting a TIN."
        >

            <div class="service-icon gold">

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M6 3h12v18H6z"/>
                    <path d="M9 7h6"/>
                    <path d="M9 11h6"/>
                    <path d="M9 15h4"/>
                </svg>

            </div>

            <div class="service-content">

                <h3>TIN</h3>

                <p>
                    Taxpayer identification services
                </p>

            </div>

        </button>


        <button
            type="button"
            class="service-card"
            data-message="Tell me how to get a driving licence."
        >

            <div class="service-icon blue">

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M4 13l2-6h12l2 6"/>
                    <path d="M4 13v5h16v-5"/>
                    <circle
                        cx="8"
                        cy="15"
                        r="1.5"
                    />
                    <circle
                        cx="16"
                        cy="15"
                        r="1.5"
                    />
                    <path d="M7 10h10"/>
                </svg>

            </div>

            <div class="service-content">

                <h3>Driving Licence</h3>

                <p>
                    Driving licence services
                </p>

            </div>

        </button>


        <button
            type="button"
            class="service-card"
            data-message="Tell me about getting a birth certificate."
        >

            <div class="service-icon red">

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M12 21s-7-4.5-7-10V5l7-3 7 3v6c0 5.5-7 10-7 10Z"/>
                    <circle
                        cx="12"
                        cy="9"
                        r="2"
                    />
                    <path d="M8.5 15h7"/>
                </svg>

            </div>

            <div class="service-content">

                <h3>Birth Certificate</h3>

                <p>
                    Birth registration services
                </p>

            </div>

        </button>


        <button
            type="button"
            class="service-card"
            data-message="Tell me about land services in Tanzania."
        >

            <div class="service-icon">

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M3 20h18"/>
                    <path d="M5 20V9l7-5 7 5v11"/>
                    <path d="M8 20v-6h8v6"/>
                    <path d="M9 10h6"/>
                </svg>

            </div>

            <div class="service-content">

                <h3>Land Services</h3>

                <p>
                    Land ownership and services
                </p>

            </div>

        </button>

    </div>
`;
```

}

/* =========================================================
RENDER MESSAGE
========================================================= */

function renderMessage(
role,
content
) {

```
const row =
    document.createElement("div");

row.className =
    `message-row ${role}`;

const message =
    document.createElement("div");

message.className =
    "message";

message.innerHTML =
    formatMessage(content);

row.appendChild(message);

chatBox.appendChild(row);
```

}

/* =========================================================
FORMAT BOT RESPONSE
========================================================= */

function formatMessage(text) {

```
if (!text) {
    return "";
}

let formatted =
    escapeHTML(text);

/*
 * Convert simple Markdown-style formatting
 * into safe HTML.
 */

formatted =
    formatted.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

formatted =
    formatted.replace(
        /\*(.*?)\*/g,
        "<em>$1</em>"
    );

/*
 * Convert numbered lists.
 */

formatted =
    formatted.replace(
        /(^|\n)(\d+)\.\s+(.*)/g,
        "$1<span class=\"formatted-list-item\">$2. $3</span>"
    );

/*
 * Convert bullet points.
 */

formatted =
    formatted.replace(
        /(^|\n)[-•]\s+(.*)/g,
        "$1<span class=\"formatted-list-item\">• $2</span>"
    );

/*
 * Convert line breaks.
 */

formatted =
    formatted.replace(
        /\n/g,
        "<br>"
    );

return formatted;
```

}

/* =========================================================
ESCAPE HTML
========================================================= */

function escapeHTML(text) {

```
const div =
    document.createElement("div");

div.textContent =
    text;

return div.innerHTML;
```

}

/* =========================================================
TYPING INDICATOR
========================================================= */

function showTyping() {

```
hideTyping();

const row =
    document.createElement("div");

row.id =
    "typingIndicator";

row.className =
    "typing-row";

row.innerHTML = `

    <div class="typing-indicator">

        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>

    </div>
`;

chatBox.appendChild(row);

scrollToBottom(true);
```

}

function hideTyping() {

```
const typing =
    document.getElementById(
        "typingIndicator"
    );

if (typing) {
    typing.remove();
}
```

}

/* =========================================================
WAITING STATE
========================================================= */

function setWaiting(state) {

```
isWaiting =
    state;

sendButton.disabled =
    state;

messageInput.disabled =
    state;

if (state) {

    sendButton.setAttribute(
        "aria-label",
        "Sending message"
    );

} else {

    sendButton.setAttribute(
        "aria-label",
        "Send message"
    );
}
```

}

/* =========================================================
SCROLL
========================================================= */

function scrollToBottom(
smooth = true
) {

```
requestAnimationFrame(() => {

    chatBox.scrollTo({
        top: chatBox.scrollHeight,

        behavior:
            smooth
                ? "smooth"
                : "auto"
    });

});
```

}

/* =========================================================
CHAT HISTORY
========================================================= */

function renderHistory() {

```
chatHistory.innerHTML = "";

historyCount.textContent =
    chats.length;

if (chats.length === 0) {

    chatHistory.innerHTML = `
        <div class="empty-history">
            No conversations yet
        </div>
    `;

    return;
}

chats.forEach(
    chat => {

        const item =
            document.createElement("div");

        item.className =
            "history-item";

        if (
            chat.id === currentChatId
        ) {
            item.classList.add(
                "active"
            );
        }

        item.innerHTML = `

            <div class="history-item-icon">
                ${icons.chat}
            </div>

            <div class="history-item-content">

                <div class="history-item-title">
                    ${escapeHTML(chat.title)}
                </div>

                <div class="history-item-date">
                    ${formatDate(chat.updatedAt)}
                </div>

            </div>

            <button
                type="button"
                class="history-delete"
                title="Delete conversation"
                aria-label="Delete conversation"
            >
                ${icons.delete}
            </button>
        `;

        item.addEventListener(
            "click",
            () => {
                switchChat(chat.id);
            }
        );

        const deleteButton =
            item.querySelector(
                ".history-delete"
            );

        deleteButton.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                deleteChat(
                    chat.id
                );
            }
        );

        chatHistory.appendChild(
            item
        );
    }
);
```

}

/* =========================================================
DELETE CHAT
========================================================= */

function deleteChat(chatId) {

```
const index =
    chats.findIndex(
        chat =>
            chat.id === chatId
    );

if (index === -1) {
    return;
}

chats.splice(
    index,
    1
);

/*
 * If the deleted chat was active,
 * open another chat automatically.
 */

if (
    currentChatId === chatId
) {

    if (chats.length > 0) {

        currentChatId =
            chats[0].id;

    } else {

        currentChatId =
            null;

        createNewChat(false);
    }
}

saveChats();

renderHistory();

renderCurrentChat();
```

}

/* =========================================================
CLEAR ALL HISTORY
========================================================= */

function clearAllChats() {

```
if (isWaiting) {
    return;
}

if (chats.length === 0) {
    return;
}

const confirmed =
    window.confirm(
        "Clear all conversations?"
    );

if (!confirmed) {
    return;
}

chats = [];

currentChatId =
    null;

saveChats();

createNewChat(false);

renderHistory();

renderCurrentChat();

messageInput.focus();
```

}

/* =========================================================
LOCAL STORAGE
========================================================= */

function saveChats() {

```
try {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
    );

} catch (error) {

    console.error(
        "Could not save chats:",
        error
    );
}
```

}

function loadChats() {

```
try {

    const stored =
        localStorage.getItem(
            STORAGE_KEY
        );

    if (!stored) {
        chats = [];
        return;
    }

    const parsed =
        JSON.parse(stored);

    if (!Array.isArray(parsed)) {
        chats = [];
        return;
    }

    chats =
        parsed.filter(
            chat =>
                chat &&
                chat.id &&
                Array.isArray(
                    chat.messages
                )
        );

} catch (error) {

    console.error(
        "Could not load chats:",
        error
    );

    chats = [];
}
```

}

/* =========================================================
THEME
========================================================= */

function loadTheme() {

```
const savedTheme =
    localStorage.getItem(
        THEME_KEY
    );

if (
    savedTheme === "dark"
) {

    document.body.classList.add(
        "dark-mode"
    );

} else {

    document.body.classList.remove(
        "dark-mode"
    );
}
```

}

function toggleTheme() {

```
const isDark =
    document.body.classList.toggle(
        "dark-mode"
    );

localStorage.setItem(
    THEME_KEY,
    isDark
        ? "dark"
        : "light"
);

updateThemeUI();
```

}

function updateThemeUI() {

```
const isDark =
    document.body.classList.contains(
        "dark-mode"
    );

if (isDark) {

    themeIcon.innerHTML =
        icons.sun;

    themeText.textContent =
        "Light Mode";

    themeToggle.setAttribute(
        "aria-label",
        "Switch to light mode"
    );

} else {

    themeIcon.innerHTML =
        icons.moon;

    themeText.textContent =
        "Dark Mode";

    themeToggle.setAttribute(
        "aria-label",
        "Switch to dark mode"
    );
}
```

}

/* =========================================================
MOBILE SIDEBAR
========================================================= */

function openMobileSidebar() {

```
sidebar.classList.add(
    "open"
);

if (sidebarOverlay) {

    sidebarOverlay.classList.add(
        "active"
    );
}
```

}

function closeMobileSidebar() {

```
sidebar.classList.remove(
    "open"
);

if (sidebarOverlay) {

    sidebarOverlay.classList.remove(
        "active"
    );
}
```

}

/* =========================================================
GENERATE CHAT ID
========================================================= */

function generateId() {

```
return (
    Date.now().toString(36) +
    "-" +
    Math.random()
        .toString(36)
        .substring(2, 10)
);
```

}

/* =========================================================
FORMAT DATE
========================================================= */

function formatDate(timestamp) {

```
if (!timestamp) {
    return "";
}

const date =
    new Date(timestamp);

const now =
    new Date();

const sameDay =
    date.toDateString() ===
    now.toDateString();

if (sameDay) {

    return date.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

return date.toLocaleDateString(
    [],
    {
        day: "numeric",
        month: "short"
    }
);
```

}

/* =========================================================
HANDLE WINDOW RESIZE
========================================================= */

window.addEventListener(
"resize",
() => {

```
    if (
        window.innerWidth > 768
    ) {
        closeMobileSidebar();
    }

}
```

);
