const ROUND_DOWN = 0;
const CONTRACT_ABI = {
  wrappedTokenGatewayV3ABI:
    "https://raw.githubusercontent.com/corndao/aave-v3-bos-app/main/abi/WrappedTokenGatewayV3ABI.json",
  erc20Abi:
    "https://raw.githubusercontent.com/corndao/aave-v3-bos-app/main/abi/ERC20Permit.json",
  aavePoolV3ABI:
    "https://raw.githubusercontent.com/corndao/aave-v3-bos-app/main/abi/AAVEPoolV3.json",
};

if (
  state.chainId === undefined &&
  ethers !== undefined &&
  Ethers.send("eth_requestAccounts", [])[0]
) {
  Ethers.provider()
    .getNetwork()
    .then((data) => {
      if (data?.chainId) {
        State.update({ chainId: data.chainId });
      }
    });
}

function isValid(a) {
  if (!a) return false;
  if (isNaN(Number(a))) return false;
  if (a === "") return false;
  return true;
}

// interface Market {
//   id: string,
//   underlyingAsset: string,
//   name: string,
//   symbol: string,
//   decimals: number,
// }
// returns Market[]
function getMarkets(chainId) {
  return fetch(`https://aave-api.pages.dev/${chainId}/markets`);
}

/**
 * @param {string} account user address
 * @param {string[]} tokens list of token addresses
 */
// interface TokenBalance {
//   token: string,
//   balance: string,
//   decimals: number,
// }
// returns TokenBalance[]
function getUserBalances(chainId, account, tokens) {
  const url = `https://aave-api.pages.dev/${chainId}/balances?account=${account}&tokens=${tokens.join(
    "|"
  )}`;
  return fetch(url);
}

// interface UserDeposit {
//   underlyingAsset: string,
//   name: string,
//   symbol: string,
//   scaledATokenBalance: string,
//   usageAsCollateralEnabledOnUser: boolean,
//   underlyingBalance: string,
//   underlyingBalanceUSD: string,
// }
// returns UserDeposit[]
function getUserDeposits(chainId, address) {
  return fetch(`https://aave-api.pages.dev/${chainId}/deposits/${address}`);
}

// Get AAVE config by chain id
function getAAVEConfig(chainId) {
  switch (chainId) {
    case 1: // ethereum mainnet
      return {
        chainName: "Ethereum Mainnet",
        aavePoolV3Address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        wrappedTokenGatewayV3Address:
          "0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C",
        wrappedTokenGatewayV3ABI: fetch(CONTRACT_ABI.wrappedTokenGatewayV3ABI),
        erc20Abi: fetch(CONTRACT_ABI.erc20Abi),
        aavePoolV3ABI: fetch(CONTRACT_ABI.aavePoolV3ABI),
      };
    case 42161: // arbitrum one
      return {
        chainName: "Arbitrum Mainnet",
        aavePoolV3Address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        wrappedTokenGatewayV3Address:
          "0xB5Ee21786D28c5Ba61661550879475976B707099",
        wrappedTokenGatewayV3ABI: fetch(CONTRACT_ABI.wrappedTokenGatewayV3ABI),
        erc20Abi: fetch(CONTRACT_ABI.erc20Abi),
        aavePoolV3ABI: fetch(CONTRACT_ABI.aavePoolV3ABI),
      };
    case 137: // polygon mainnet
      return {
        chainName: "Polygon Mainnet",
        aavePoolV3Address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        wrappedTokenGatewayV3Address:
          "0x1e4b7A6b903680eab0c5dAbcb8fD429cD2a9598c",
        wrappedTokenGatewayV3ABI: fetch(CONTRACT_ABI.wrappedTokenGatewayV3ABI),
        erc20Abi: fetch(CONTRACT_ABI.erc20Abi),
        aavePoolV3ABI: fetch(CONTRACT_ABI.aavePoolV3ABI),
      };
    case 1442: // zkevm testnet
      return {
        chainName: "Polygon zkEVM Testnet",
        aavePoolV3Address: "0x4412c92f6579D9FC542D108382c8D1d6D2Be63d9",
        wrappedTokenGatewayV3Address:
          "0xD82940E16D25aB1349914e1C369eF1b287d457BF",
        wrappedTokenGatewayV3ABI: fetch(CONTRACT_ABI.wrappedTokenGatewayV3ABI),
        erc20Abi: fetch(CONTRACT_ABI.erc20Abi),
        aavePoolV3ABI: fetch(CONTRACT_ABI.aavePoolV3ABI),
      };
    default:
      throw new Error("unknown chain id");
  }
}

// App config
function getConfig(network) {
  const chainId = state.chainId;
  switch (network) {
    case "mainnet":
      return {
        ownerId: "aave-v3.near",
        nodeUrl: "https://rpc.mainnet.near.org",
        ipfsPrefix: "https://ipfs.near.social/ipfs",
        ...(chainId ? getAAVEConfig(chainId) : {}),
      };
    case "testnet":
      return {
        ownerId: "aave-v3.testnet",
        nodeUrl: "https://rpc.testnet.near.org",
        ipfsPrefix: "https://ipfs.near.social/ipfs",
        ...(chainId ? getAAVEConfig(chainId) : {}),
      };
    default:
      throw Error(`Unconfigured environment '${network}'.`);
  }
}
const config = getConfig(context.networkId);

// App states
State.init({
  imports: {},
  chainId: undefined,
  showWithdrawModal: false,
  showSupplyModal: false,
  connectWallet: true,
  assetsToSupply: undefined,
  yourSupplies: undefined,
  address: undefined,
  ethBalance: undefined,
});

const loading = !state.assetsToSupply || !state.yourSupplies;

// Import functions to state.imports
function importFunctions(imports) {
  if (loading) {
    State.update({
      imports,
    });
  }
}

// Define the modules you'd like to import
const modules = {
  number: `${config.ownerId}/widget/Utils.Number`,
  date: `${config.ownerId}/widget/Utils.Date`,
  data: `${config.ownerId}/widget/AAVE.Data`,
};
// Import functions
const { formatAmount } = state.imports.number;
const { formatDateTime } = state.imports.date;

function initData() {
  const provider = Ethers.provider();
  if (!provider) {
    State.update({ connectWallet: false });
    return;
  } else {
    State.update({ connectWallet: true });
  }
  provider
    .getSigner()
    ?.getAddress()
    ?.then((address) => {
      State.update({ address });
    });
  provider
    .getSigner()
    ?.getBalance()
    .then((balance) => State.update({ ethBalance: balance }));
  if (!state.address || !state.ethBalance) {
    return;
  }
  const marketsResponse = getMarkets(state.chainId);
  if (!marketsResponse) {
    return;
  }
  const markets = JSON.parse(marketsResponse.body);
  const userBalancesResponse = getUserBalances(
    state.chainId,
    state.address,
    markets.map((market) => market.underlyingAsset)
  );
  if (!userBalancesResponse) {
    return;
  }
  const userBalances = JSON.parse(userBalancesResponse.body);
  const assetsToSupply = markets.map((market, idx) => {
    if (!isValid(userBalances[idx].decimals)) {
      return;
    }
    const balanceRaw = Big(
      market.symbol === "WETH" ? state.ethBalance : userBalances[idx].balance
    ).div(Big(10).pow(userBalances[idx].decimals));
    const balance = balanceRaw.toFixed(7, ROUND_DOWN);
    const balanceInUSD = balanceRaw
      .mul(market.marketReferencePriceInUsd)
      .toFixed(3, ROUND_DOWN);
    return {
      ...userBalances[idx],
      ...market,
      balance,
      balanceInUSD,
      ...(market.symbol === "WETH"
        ? {
            symbol: "ETH",
            name: "Ethereum",
          }
        : {}),
    };
  });
  State.update({
    assetsToSupply,
  });

  // yourSupplies
  const userDepositsResponse = getUserDeposits(state.chainId, state.address);
  if (!userDepositsResponse) {
    return;
  }
  const userDeposits = JSON.parse(userDepositsResponse.body).filter(
    (row) => Number(row.underlyingBalance) !== 0
  );
  const marketsMapping = markets.reduce((prev, cur) => {
    prev[cur.symbol] = cur;
    return prev;
  }, {});
  const yourSupplies = userDeposits.map((userDeposit) => {
    const market = marketsMapping[userDeposit.symbol];
    return {
      ...market,
      ...userDeposit,
      ...(market.symbol === "WETH"
        ? {
            symbol: "ETH",
            name: "Ethereum",
          }
        : {}),
    };
  });
  State.update({
    yourSupplies,
  });
}

if (state.chainId) {
  initData();
}

const Body = styled.div`
  padding: 24px 15px;
  background: #0e0e26;
  min-height: 100vh;
  color: white;
`;

const FlexContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`;
// Component body
const body = loading ? (
  <>
    <Widget src={`${config.ownerId}/widget/AAVE.Header`} props={{ config }} />
    <Body>
      {state.connectWallet ? "Loading" : "Need to connect wallet first."}
    </Body>
  </>
) : (
  <>
    <Widget src={`${config.ownerId}/widget/AAVE.Header`} props={{ config }} />
    <Body>
      <FlexContainer>
        <Widget
          src={`${config.ownerId}/widget/AAVE.NetworkSwitcher`}
          props={{
            chainId: state.chainId,
            config,
            switchNetwork: (chainId) => {
              Ethers.send("wallet_switchEthereumChain", [
                { chainId: `0x${chainId.toString(16)}` },
              ]);
            },
          }}
        />
      </FlexContainer>
      <Widget
        src={`${config.ownerId}/widget/AAVE.TabSwitcher`}
        props={{ config }}
      />
      <Widget
        src={`${config.ownerId}/widget/AAVE.Card.YourSupplies`}
        props={{
          config,
          yourSupplies: state.yourSupplies,
          showWithdrawModal: state.showWithdrawModal,
          setShowWithdrawModal: (isShow) =>
            State.update({ showWithdrawModal: isShow }),
          showAlertModal: (msg) => State.update({ alarmModalText: msg }),
        }}
      />
      <Widget
        src={`${config.ownerId}/widget/AAVE.Card.AssetsToSupply`}
        props={{
          config,
          chainId: state.chainId,
          assetsToSupply: state.assetsToSupply,
          showSupplyModal: state.showSupplyModal,
          setShowSupplyModal: (isShow) =>
            State.update({ showSupplyModal: isShow }),
          showAlertModal: (msg) => State.update({ alarmModalText: msg }),
        }}
      />
      {state.alarmModalText && (
        <Widget
          src={`${config.ownerId}/widget/AAVE.Modal.AlertModal`}
          props={{
            config,
            title: "All done!",
            description: state.alarmModalText,
            onRequestClose: () => State.update({ alarmModalText: false }),
          }}
        />
      )}
    </Body>
  </>
);

return (
  <div>
    {/* Component Head */}
    <Widget
      src={`${config.ownerId}/widget/Utils.Import`}
      props={{ modules, onLoad: importFunctions }}
    />
    {/* Component Body */}
    {body}
  </div>
);
