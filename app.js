const ethereum = window.ethereum;

const CHAINS = {
  "0x1": { name: "Ethereum", symbol: "ETH" },
  "0xaa36a7": { name: "Sepolia", symbol: "ETH" },
  "0x89": { name: "Polygon", symbol: "POL" },
  "0x13882": { name: "Polygon Amoy", symbol: "POL" },
  "0xa": { name: "Optimism", symbol: "ETH" },
  "0x2105": { name: "Base", symbol: "ETH" },
  "0x14a34": { name: "Base Sepolia", symbol: "ETH" },
  "0xa4b1": { name: "Arbitrum One", symbol: "ETH" },
};

const SWITCHABLE_CHAINS = [
  { id: "0xaa36a7", name: "Sepolia", type: "Testnet" },
  { id: "0x14a34", name: "Base Sepolia", type: "Testnet" },
  { id: "0x1", name: "Ethereum", type: "Mainnet" },
  { id: "0x2105", name: "Base", type: "Mainnet" },
  { id: "0x89", name: "Polygon", type: "Mainnet" },
];

const state = { account: null, chainId: null, pendingTransfer: null };
const $ = (id) => document.getElementById(id);

const ui = {
  connectButton: $("connectButton"), networkButton: $("networkButton"), networkLabel: $("networkLabel"),
  statusDot: $("statusDot"), walletState: $("walletState"), balanceValue: $("balanceValue"),
  currencyLabel: $("currencyLabel"), sendCurrencyLabel: $("sendCurrencyLabel"), addressLabel: $("addressLabel"),
  copyAddressButton: $("copyAddressButton"), signButton: $("signButton"), sendButton: $("sendButton"),
  signTabButton: $("signTabButton"), sendTabButton: $("sendTabButton"), toast: $("toast"),
  networkDialog: $("networkDialog"), confirmDialog: $("confirmDialog"), walletBrowserLink: $("walletBrowserLink"),
};

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(hexWei) {
  const wei = BigInt(hexWei);
  const whole = wei / 10n ** 18n;
  const fraction = (wei % 10n ** 18n).toString().padStart(18, "0").slice(0, 4);
  return `${whole}.${fraction}`;
}

function toWeiHex(amount) {
  if (!/^\d+(\.\d{1,18})?$/.test(amount)) throw new Error("Enter a valid token amount");
  const [whole, fraction = ""] = amount.split(".");
  const wei = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0"));
  if (wei <= 0n) throw new Error("The amount must be greater than 0");
  return `0x${wei.toString(16)}`;
}

function toHexUtf8(value) {
  return `0x${Array.from(new TextEncoder().encode(value)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function showToast(message, isError = false) {
  ui.toast.textContent = message;
  ui.toast.classList.toggle("error", isError);
  ui.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => ui.toast.classList.remove("show"), 3400);
}

function humanizeError(error) {
  if (error?.code === 4001) return "You cancelled the wallet request";
  if (error?.code === -32002) return "A wallet request is already pending";
  return error?.shortMessage || error?.message?.replace(/^MetaMask - RPC Error:\s*/, "") || "The action could not be completed. Try again.";
}

async function refreshWallet() {
  if (!ethereum || !state.account) return;
  try {
    const [chainId, balance] = await Promise.all([
      ethereum.request({ method: "eth_chainId" }),
      ethereum.request({ method: "eth_getBalance", params: [state.account, "latest"] }),
    ]);
    state.chainId = chainId;
    const chain = CHAINS[chainId] || { name: `Chain ${parseInt(chainId, 16)}`, symbol: "TOKEN" };
    ui.networkLabel.textContent = chain.name;
    ui.balanceValue.textContent = formatBalance(balance);
    ui.currencyLabel.textContent = chain.symbol;
    ui.sendCurrencyLabel.textContent = chain.symbol;
  } catch (error) {
    showToast(humanizeError(error), true);
  }
}

function setConnected(account) {
  state.account = account;
  const connected = Boolean(account);
  ui.connectButton.textContent = connected ? shortAddress(account) : "Connect wallet";
  ui.addressLabel.textContent = connected ? shortAddress(account) : "Connect to reveal your address";
  ui.walletState.textContent = connected ? "Connected" : "Offline";
  ui.walletState.classList.toggle("online", connected);
  ui.statusDot.classList.toggle("online", connected);
  [ui.networkButton, ui.copyAddressButton, ui.signButton, ui.sendButton, ui.signTabButton, ui.sendTabButton].forEach((element) => { element.disabled = !connected; });
  if (connected) refreshWallet();
  else {
    ui.networkLabel.textContent = "Not connected";
    ui.balanceValue.textContent = "0.0000";
  }
}

async function connectWallet() {
  if (!ethereum) {
    ui.walletBrowserLink.classList.remove("hidden");
    showToast("No wallet detected. Open this site in your wallet app browser.", true);
    return;
  }
  ui.connectButton.disabled = true;
  ui.connectButton.textContent = "Waiting for approval...";
  try {
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    setConnected(accounts[0]);
    showToast("Wallet connected");
  } catch (error) {
    setConnected(null);
    showToast(humanizeError(error), true);
  } finally {
    ui.connectButton.disabled = false;
  }
}

function activateTab(tabName, shouldScroll = false) {
  const isSign = tabName === "sign";
  $("signTab").classList.toggle("active", isSign);
  $("sendTab").classList.toggle("active", !isSign);
  $("signTab").setAttribute("aria-selected", String(isSign));
  $("sendTab").setAttribute("aria-selected", String(!isSign));
  $("signPanel").classList.toggle("hidden", !isSign);
  $("sendPanel").classList.toggle("hidden", isSign);
  if (shouldScroll) $("workspace").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function signMessage() {
  const message = $("messageInput").value.trim();
  if (!message) return showToast("Enter a message to sign", true);
  try {
    ui.signButton.disabled = true;
    ui.signButton.textContent = "Waiting for wallet...";
    const signature = await ethereum.request({ method: "personal_sign", params: [toHexUtf8(message), state.account] });
    $("signatureValue").textContent = signature;
    $("signatureResult").classList.remove("hidden");
    showToast("Message signed");
  } catch (error) {
    showToast(humanizeError(error), true);
  } finally {
    ui.signButton.disabled = false;
    ui.signButton.textContent = "Request signature";
  }
}

async function switchNetwork(chainId) {
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
    ui.networkDialog.close();
    await refreshWallet();
    showToast("Network switched");
  } catch (error) {
    showToast(error?.code === 4902 ? "This network has not been added to your wallet" : humanizeError(error), true);
  }
}

function prepareTransfer(event) {
  event.preventDefault();
  const recipient = $("recipientInput").value.trim();
  const amount = $("amountInput").value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) return showToast("Enter a valid EVM recipient address", true);
  try { toWeiHex(amount); } catch (error) { return showToast(error.message, true); }
  state.pendingTransfer = { recipient, amount };
  $("confirmRecipient").textContent = shortAddress(recipient);
  $("confirmAmount").textContent = `${amount} ${CHAINS[state.chainId]?.symbol || "TOKEN"}`;
  $("confirmNetwork").textContent = CHAINS[state.chainId]?.name || `Chain ${parseInt(state.chainId, 16)}`;
  ui.confirmDialog.showModal();
}

async function sendTransfer() {
  if (!state.pendingTransfer) return;
  const { recipient, amount } = state.pendingTransfer;
  try {
    $("confirmSendButton").disabled = true;
    $("confirmSendButton").textContent = "Waiting for wallet...";
    const txHash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: state.account, to: recipient, value: toWeiHex(amount) }],
    });
    ui.confirmDialog.close();
    $("recipientInput").value = "";
    $("amountInput").value = "";
    showToast(`Transaction submitted ${shortAddress(txHash)}`);
    setTimeout(refreshWallet, 1500);
  } catch (error) {
    showToast(humanizeError(error), true);
  } finally {
    $("confirmSendButton").disabled = false;
    $("confirmSendButton").textContent = "Confirm in wallet";
  }
}

function initNetworkList() {
  const list = $("networkList");
  SWITCHABLE_CHAINS.forEach((chain) => {
    const button = document.createElement("button");
    button.className = "network-option";
    button.type = "button";
    const name = document.createElement("span");
    const type = document.createElement("span");
    name.textContent = chain.name;
    type.textContent = chain.type;
    button.append(name, type);
    button.addEventListener("click", () => switchNetwork(chain.id));
    list.appendChild(button);
  });
}

function init() {
  const dappPath = `${location.host}${location.pathname}`.replace(/^https?:\/\//, "");
  ui.walletBrowserLink.href = `https://metamask.app.link/dapp/${dappPath}`;
  if (!ethereum && /Android|iPhone|iPad/i.test(navigator.userAgent)) ui.walletBrowserLink.classList.remove("hidden");

  initNetworkList();
  ui.connectButton.addEventListener("click", connectWallet);
  ui.networkButton.addEventListener("click", () => ui.networkDialog.showModal());
  $("closeNetworkDialog").addEventListener("click", () => ui.networkDialog.close());
  $("closeConfirmDialog").addEventListener("click", () => ui.confirmDialog.close());
  $("signTab").addEventListener("click", () => activateTab("sign"));
  $("sendTab").addEventListener("click", () => activateTab("send"));
  ui.signTabButton.addEventListener("click", () => activateTab("sign", true));
  ui.sendTabButton.addEventListener("click", () => activateTab("send", true));
  ui.signButton.addEventListener("click", signMessage);
  $("sendPanel").addEventListener("submit", prepareTransfer);
  $("confirmSendButton").addEventListener("click", sendTransfer);
  ui.copyAddressButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(state.account);
    showToast("Wallet address copied");
  });

  if (ethereum) {
    ethereum.request({ method: "eth_accounts" }).then((accounts) => setConnected(accounts[0] || null));
    ethereum.on?.("accountsChanged", (accounts) => setConnected(accounts[0] || null));
    ethereum.on?.("chainChanged", () => refreshWallet());
  }

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js");
}

init();
