const formElement = document.getElementById("form");
const emailInputElement = document.getElementById("email");
const gmailOutputElement = document.getElementById("gmail");
const googleDriveOutputElement = document.getElementById("google_drive");
const gmail2OutputElement = document.getElementById("gmail2");
const googleDrive2OutputElement = document.getElementById("google_drive2");
const googleCalendarOutputElement = document.getElementById("google_calendar");

/**
 *
 * @param {HTMLOutputElement} element
 * @param {string} url
 */
function setOutputUrl(element, url) {
  const anchor = document.createElement("a");
  anchor.appendChild(document.createTextNode(url));
  anchor.href = url;
  element.replaceChildren(anchor);
}

formElement.addEventListener("input", function () {
  if (!(emailInputElement instanceof HTMLInputElement)) {
    throw new Error("invalid type");
  }
  const email = emailInputElement.value;
  if (!email) {
    gmailOutputElement.value = "";
    googleDriveOutputElement.value = "";
    gmail2OutputElement.value = "";
    googleDrive2OutputElement.value = "";
    return;
  }
  const emailSplit = email.split("@");
  const domain = emailSplit.length >= 2 ? emailSplit[1] : "google.com";
  setOutputUrl(gmailOutputElement, `https://mail.google.com/mail/u/${email}`);
  setOutputUrl(
    googleDriveOutputElement,
    `https://drive.google.com/drive/u/${email}`,
  );
  setOutputUrl(
    gmail2OutputElement,
    `https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fmail.google.com%2Fmail%2Fu%2F%2F&Email=${encodeURIComponent(
      email,
    )}`,
  );
  setOutputUrl(
    googleDrive2OutputElement,
    `https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fdrive.google.com%3Fauthuser%3D%26ogss%3D1%2F&Email=${encodeURIComponent(
      email,
    )}`,
  );
  const calendarUrl = `https://www.google.com/calendar/a/${domain}`;
  setOutputUrl(
    googleCalendarOutputElement,
    `https://accounts.google.com/AccountChooser?Email=${encodeURIComponent(
      email,
    )}&continue=${encodeURIComponent(calendarUrl)}`,
  );
});

formElement.addEventListener("submit", function (e) {
  e.preventDefault();
});
