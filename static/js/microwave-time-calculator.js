const formElement = document.getElementById("form");

const boxWattageInput = document.getElementById("box_wattage");
const boxMinutesInput = document.getElementById("box_minutes");
const boxSecondsInput = document.getElementById("box_seconds");
const boxPowerInput = document.getElementById("box_power");
const yourWattageInput = document.getElementById("your_wattage");
const plus15Btn = document.getElementById("plus_15_s");
const minus15Btn = document.getElementById("minus_15_s");
const plus1Btn = document.getElementById("plus_1_s");
const minus1Btn = document.getElementById("minus_1_s");
const plus1PowerBtn = document.getElementById("plus_1_power");
const minus1PowerBtn = document.getElementById("minus_1_power");
const plusBoxWattageBtn = document.getElementById("plus_box_wattage");
const minusBoxWattageBtn = document.getElementById("minus_box_wattage");
const plusYourWattageBtn = document.getElementById("plus_your_wattage");
const minusYourWattageBtn = document.getElementById("minus_your_wattage");

if (!(boxMinutesInput instanceof HTMLInputElement)) {
  throw new Error("Invalid type");
}

if (!(boxSecondsInput instanceof HTMLInputElement)) {
  throw new Error("Invalid type");
}

if (!(boxPowerInput instanceof HTMLInputElement)) {
  throw new Error("Invalid type");
}

function secondsToMinsSecs(seconds) {
  return {
    minutes: Math.floor(seconds / 60),
    seconds: Math.round(seconds % 60),
  };
}

/**
 * @param {number} value
 * @param {number} nanValue
 */
function valueOrDefault(value, nanValue) {
  return isNaN(value) ? nanValue : value;
}

const getBoxSeconds = () =>
  valueOrDefault(parseInt(boxMinutesInput.value, 10) * 60, 0) +
  valueOrDefault(parseInt(boxSecondsInput.value, 10), 0);

/**
 * @param {number} delta
 */
const timeBtnClickHandler = (delta) => () => {
  const newSeconds = Math.max(1, getBoxSeconds() + delta);
  const { minutes, seconds } = secondsToMinsSecs(newSeconds);
  boxMinutesInput.value = minutes;
  boxSecondsInput.value = seconds;
  computeTime();
};

plus15Btn.addEventListener("click", timeBtnClickHandler(15));
minus15Btn.addEventListener("click", timeBtnClickHandler(-15));
plus1Btn.addEventListener("click", timeBtnClickHandler(1));
minus1Btn.addEventListener("click", timeBtnClickHandler(-1));

/**
 * @param {number} delta
 */
const powerBtnClickHandler = (delta) => () => {
  boxPowerInput.value = Math.max(
    1,
    Math.min(10, parseInt(boxPowerInput.value, 10) + delta),
  );
  computeTime();
};

plus1PowerBtn.addEventListener("click", powerBtnClickHandler(1));
minus1PowerBtn.addEventListener("click", powerBtnClickHandler(-1));

/**
 *
 * @param {number} delta
 * @param {HTMLInputElement} element
 * @returns
 */
const wattageBtnClickHandler = (delta, element) => () => {
  element.value = Math.max(1, parseInt(element.value, 10) + delta);
  computeTime();
};

plusBoxWattageBtn.addEventListener(
  "click",
  wattageBtnClickHandler(25, boxWattageInput),
);
minusBoxWattageBtn.addEventListener(
  "click",
  wattageBtnClickHandler(-25, boxWattageInput),
);
plusYourWattageBtn.addEventListener(
  "click",
  wattageBtnClickHandler(25, yourWattageInput),
);
minusYourWattageBtn.addEventListener(
  "click",
  wattageBtnClickHandler(-25, yourWattageInput),
);

const urlParams = new URLSearchParams(window.location.search);
urlParams.forEach((value, key) => {
  const element = document.getElementById(key);
  if (element) {
    element.value = value;
  }
});

const resultTimeElement = document.getElementById("result_time");
const resultPowerElement = document.getElementById("result_power");

function computeTime() {
  if (!(boxWattageInput instanceof HTMLInputElement)) {
    throw new Error("Invalid type");
  }
  if (!(yourWattageInput instanceof HTMLInputElement)) {
    throw new Error("Invalid type");
  }
  if (!(boxPowerInput instanceof HTMLInputElement)) {
    throw new Error("Invalid type");
  }
  const boxWattage = valueOrDefault(parseInt(boxWattageInput.value, 10), 1100);
  const boxSeconds = getBoxSeconds();
  const boxPower = valueOrDefault(parseInt(boxPowerInput.value, 10), 10);
  const yourWattage = valueOrDefault(parseInt(yourWattageInput.value, 10), 975);

  const newUrl = new URL(window.location.href);
  newUrl.searchParams.set("box_wattage", boxWattage);
  newUrl.searchParams.set("your_wattage", yourWattage);
  window.history.replaceState({}, "", newUrl.pathname + newUrl.search);

  // We want the desired power to be as close to the power of the microwave
  // used to make the calculations on the box. Obviously, this can't be greater
  // than 10 (i.e. 100%).
  const resultPower = Math.min(
    Math.round(boxPower * (boxWattage / yourWattage)),
    10,
  );

  // Now that we have the power setting for the user's microwave that gets them
  // closest to the box wattage, we need to calculate what the effective wattages
  // of both are after taking into account the power settings for each. This
  // assumes 10 = 100%, 5 = 50%, etc.
  const effectiveBoxWattage = boxWattage * (boxPower / 10);
  const effectiveYourWattage = yourWattage * (resultPower / 10);

  const resultSeconds =
    boxSeconds * (effectiveBoxWattage / effectiveYourWattage);

  resultTimeElement.innerText = `${Math.floor(
    resultSeconds / 60,
  )} min ${Math.round(resultSeconds % 60)} sec`;
  resultPowerElement.innerText = resultPower;
}

formElement.addEventListener("input", computeTime);

computeTime();
