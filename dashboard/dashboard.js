const storeKey = "sh143_stream_ballot";

window.addEventListener('onEventReceived', function (obj) {
  if (!obj.detail.event) {
    return;
  }
  if (typeof obj.detail.event.itemId !== "undefined") {
    obj.detail.listener = "redemption-latest"
  }
  
  const listener = obj.detail.listener || obj.detail.name;
  const event = obj.detail.event || obj.detail.data;
  
  if(listener === "kvstore:update" && event.data.key === `customWidget.${storeKey}`) {
    update(event.data.value || {});
  }
  
});

function send(type, data) {
  SE_API.store.set(`${storeKey}_cmd`, { type, data });
}

function redeem() {
  const name = document.querySelector("#list").value;
  const option = document.querySelector("#options").value;
  
  if(!name || !option) {
    return;
  }
  
  send("redeem", {name, option});
}

function discard() {
  const name = document.querySelector("#list").value;
  
  if(!name) {
    return;
  }
  
  send("discard", {name});
}

function update(data) {
  const disableButtons = !data.active;
  
  const discardButton = document.querySelector("#discard");
  discardButton.disabled = disableButtons;
  const redeemButton = document.querySelector("#redeem");
  redeemButton.disabled = disableButtons;
  
  const list = document.querySelector("#list");
  const optionSelect = document.querySelector("#options");
  
  const listChildren = [];
  const optionSelectChildren = [];
  let wastedSum = 0;
  let assignedSum = 0;
  
  Object.entries(data.wasted || {}).forEach(([name, amount]) => {
    wastedSum += amount;
    const option = document.createElement("option");
    option.textContent = `${name}: ${amount} €`;
    option.value = name;
    
    listChildren.push(option);
  });
  
  Object.entries(data.options || {}).forEach(([option, amount]) => {
    assignedSum += amount;
    const selectOption = document.createElement("option");
    selectOption.textContent = `${option}: ${amount} €`;
    selectOption.value = option;
    
    optionSelectChildren.push(selectOption);
  });
  
  list.replaceChildren(...listChildren);
  const previousOption = optionSelect.value;
  optionSelect.replaceChildren(...optionSelectChildren);
  if(previousOption in data.options) {
    optionSelect.value = previousOption;
  }
  
  document.querySelector("#total").textContent = `Wasted: ${wastedSum} € - Assigned: ${assignedSum} €`;
}

window.addEventListener('onWidgetLoad', function (obj) {
  document.querySelector("#discard").onclick = discard;
  document.querySelector("#redeem").onclick = redeem;
  
  SE_API.store.get(storeKey).then(obj => {
    update(obj || {});
  });
});
