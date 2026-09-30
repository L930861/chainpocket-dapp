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
  { id: "0xaa36a7", name: "Sepolia", type: "测试网" },
  { id: "0x14a34", name: "Base Sepolia", type: "测试网" },
  { id: "0x1", name: "Ethereum", type: "主网" },
  { id: "0x2105", name: "Base", type: "主网" },
  { id: "0x89", name: "Polygon", type: "主网" },
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
  if (!/^\d+(\.\d{1,18})?$/.test(amount)) throw new Error("请输入有效的代币数量");
  const [whole, fraction = ""] = amount.split(".");
  const wei = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0"));
  if (wei <= 0n) throw new Error("发送数量必须大于 0");
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
  if (error?.code === 4001) return "你已取消钱包请求";
  if (error?.code === -32002) return "钱包中已有待处理请求";
  return error?.shortMessage || error?.message?.replace(/^MetaMask - RPC Error:\s*/, "") || "操作未完成，请重试";
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
  ui.connectButton.textContent = connected ? shortAddress(account) : "连接钱包";
  ui.addressLabel.textContent = connected ? shortAddress(account) : "连接钱包后显示地址";
  ui.walletState.textContent = connected ? "已连接" : "离线";
  ui.walletState.classList.toggle("online", connected);
  ui.statusDot.classList.toggle("online", connected);
  [ui.networkButton, ui.copyAddressButton, ui.signButton, ui.sendButton, ui.signTabButton, ui.sendTabButton].forEach((element) => { element.disabled = !connected; });
  if (connected) refreshWallet();
  else {
    ui.networkLabel.textContent = "未连接";
    ui.balanceValue.textContent = "0.0000";
  }
}

async function connectWallet() {
  if (!ethereum) {
    ui.walletBrowserLink.classList.remove("hidden");
    showToast("未检测到钱包，请在钱包 App 的浏览器中打开", true);
    return;
  }
  ui.connectButton.disabled = true;
  ui.connectButton.textContent = "等待钱包授权...";
  try {
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    setConnected(accounts[0]);
    showToast("钱包连接成功");
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
  if (!message) return showToast("请输入待签名消息", true);
  try {
    ui.signButton.disabled = true;
    ui.signButton.textContent = "等待钱包确认...";
    const signature = await ethereum.request({ method: "personal_sign", params: [toHexUtf8(message), state.account] });
    $("signatureValue").textContent = signature;
    $("signatureResult").classList.remove("hidden");
    showToast("消息签名完成");
  } catch (error) {
    showToast(humanizeError(error), true);
  } finally {
    ui.signButton.disabled = false;
    ui.signButton.textContent = "请求钱包签名";
  }
}

async function switchNetwork(chainId) {
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
    ui.networkDialog.close();
    await refreshWallet();
    showToast("网络已切换");
  } catch (error) {
    showToast(error?.code === 4902 ? "钱包尚未添加该网络" : humanizeError(error), true);
  }
}

function prepareTransfer(event) {
  event.preventDefault();
  const recipient = $("recipientInput").value.trim();
  const amount = $("amountInput").value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) return showToast("请输入有效的 EVM 接收地址", true);
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
    $("confirmSendButton").textContent = "等待钱包确认...";
    const txHash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: state.account, to: recipient, value: toWeiHex(amount) }],
    });
    ui.confirmDialog.close();
    $("recipientInput").value = "";
    $("amountInput").value = "";
    showToast(`交易已提交 ${shortAddress(txHash)}`);
    setTimeout(refreshWallet, 1500);
  } catch (error) {
    showToast(humanizeError(error), true);
  } finally {
    $("confirmSendButton").disabled = false;
    $("confirmSendButton").textContent = "在钱包中确认";
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
    showToast("钱包地址已复制");
  });

  if (ethereum) {
    ethereum.request({ method: "eth_accounts" }).then((accounts) => setConnected(accounts[0] || null));
    ethereum.on?.("accountsChanged", (accounts) => setConnected(accounts[0] || null));
    ethereum.on?.("chainChanged", () => refreshWallet());
  }

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js");
}

init();
