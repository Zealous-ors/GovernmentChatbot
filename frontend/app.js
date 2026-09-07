const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const chatBox = document.getElementById("chatBox");
const themeToggle = document.getElementById("themeToggle");


// Send message
chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = messageInput.value.trim();

    if (!message) {
        return;
    }

    // Show user message
    addMessage(message, "user");

    messageInput.value = "";

    try {
        const response = await fetch("http://127.0.0.1:8000/chat", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message: message
            })
        });

        const data = await response.json();

        addMessage(data.message, "bot");

    } catch (error) {

        addMessage(
            "Sorry, I could not connect to the server.",
            "bot"
        );
    }
});


// Add message to chat
function addMessage(text, sender) {

    const message = document.createElement("div");

    message.classList.add("message", sender);

    message.textContent = text;

    chatBox.appendChild(message);

    chatBox.scrollTop = chatBox.scrollHeight;
}


// Dark / Light mode
themeToggle.addEventListener("click", () => {

    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
        themeToggle.textContent = "☀️";
    } else {
        themeToggle.textContent = "🌙";
    }
});
