import "./invite-code.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error('Could not find the app element. Add <div id="app"></div> to index.html.');
}

app.innerHTML = `
  <main class="invitation-page">
    <section class="invitation-panel" aria-labelledby="invitation-heading">
      <img
        class="invitation-logo"
        src="src/assets/parents-challenge-logo.jpg"
        alt="Parents Challenge Colorado"
      />

      <h1 id="invitation-heading">Parents Challenge Portal</h1>

      <form class="invitation-form" id="invitation-form" novalidate>
        <label for="invitation-code">Enter your invitation code</label>
        <input
          id="invitation-code"
          name="invitationCode"
          type="text"
          placeholder="XXXXXXXX"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          aria-describedby="invitation-message"
          required
        />
        <button type="submit">Submit</button>
        <p id="invitation-message" class="invitation-message" role="status" aria-live="polite" hidden></p>
      </form>

      <a class="back-to-sign-in" href="index.html">
        <span>Back to Sign In</span>
      </a>
    </section>
  </main>
`;

const form = document.querySelector<HTMLFormElement>("#invitation-form");
const codeInput = document.querySelector<HTMLInputElement>("#invitation-code");
const message = document.querySelector<HTMLParagraphElement>("#invitation-message");

if (!form || !codeInput || !message) {
  throw new Error("Could not initialize the invitation-code form.");
}

codeInput.addEventListener("input", () => {
  message.textContent = "";
  message.hidden = true;
});

form.addEventListener("submit", (event: SubmitEvent) => {
  event.preventDefault();
  const invitationCode = codeInput.value.trim();

  if (!invitationCode) {
    message.textContent = "Please enter your invitation code.";
    message.hidden = false;
    codeInput.focus();
    return;
  }
  
});
