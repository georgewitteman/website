const secondsToMinsSecs = (seconds) => ({
  minutes: seconds < 0 ? Math.ceil(seconds / 60) : Math.floor(seconds / 60),
  seconds: Math.round(seconds % 60),
});

const valueOrDefault = (value, nanValue) => (isNaN(value) ? nanValue : value);

class DurationPicker extends HTMLElement {
  constructor() {
    super();

    const inputHandler = () => {
      console.log(this.minsInput.value, this.secsInput.value);
      if (this.minsInput.value === "-" || this.secsInput.value === "-") {
        return;
      }
      const mins = parseInt(this.minsInput.value, 10);
      const secs = parseInt(this.secsInput.value, 10);
      const secsTotal = valueOrDefault(mins, 0) * 60 + valueOrDefault(secs, 0);
      const { minutes, seconds } = secondsToMinsSecs(secsTotal);
      this.minsInput.value = `${minutes}`;
      this.secsInput.value = `${seconds}`;
    };

    const minAttr = this.hasAttribute("data-min")
      ? parseInt(this.getAttribute("data-min"), 10)
      : undefined;
    const { minutes: minMinutes, seconds: minSeconds } =
      secondsToMinsSecs(minAttr);
    const secondsAttr = this.hasAttribute("data-seconds")
      ? parseInt(this.getAttribute("data-seconds"), 10)
      : isNaN(minAttr)
      ? 0
      : minAttr;
    const { minutes, seconds } = secondsToMinsSecs(secondsAttr);

    const shadow = this.attachShadow({ mode: "open" });

    const wrapper = document.createElement("div");

    const minsLabel = document.createElement("label");
    this.minsInput = document.createElement("input");
    this.minsInput.setAttribute("type", "number");
    this.minsInput.setAttribute("value", `${minutes}`);
    this.minsInput.addEventListener("change", inputHandler);
    if (!isNaN(minAttr)) {
      this.minsInput.min = minMinutes;
    }
    minsLabel.appendChild(this.minsInput);
    minsLabel.appendChild(document.createTextNode("mins"));

    const secsLabel = document.createElement("label");
    this.secsInput = document.createElement("input");
    this.secsInput.setAttribute("type", "number");
    this.secsInput.setAttribute("value", `${seconds}`);
    this.secsInput.addEventListener("change", inputHandler);
    if (!isNaN(minAttr)) {
      this.secsInput.min = minMinutes < 0 ? -60 : minSeconds - 1;
    }
    secsLabel.appendChild(this.secsInput);
    secsLabel.appendChild(document.createTextNode("secs"));

    wrapper.appendChild(minsLabel);
    wrapper.appendChild(secsLabel);
    shadow.appendChild(wrapper);
  }

  get value() {
    const mins = parseInt(this.minsInput.value, 10);
    const secs = parseInt(this.secsInput.value, 10);
    return mins + secs;
  }
}
customElements.define("duration-picker", DurationPicker);
