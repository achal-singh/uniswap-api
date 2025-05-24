<p align="center">
  <a href="https://nestjs.com/" target="_blank">
    <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" />
  </a>
  &nbsp;
  <a href="https://app.uniswap.org/" target="_blank">
    <img src="https://1000logos.net/wp-content/uploads/2022/09/Uniswap-Symbol.png" width="250" alt="Nest Logo" />
  </a>
</p>

## Introduction

This NestJS backend hosts two API routes:

1. **`/gasPrice`** - To fetch the Gas price from the Ethereum network.
2. **`/return/:fromTokenAddress/:toTokenAddress/:amountIn`** - To fetch the estimated amount of **`toTokenAddress`** for the given **`amountIn`** of **`fromTokenAddress`**.

## ⚙️ Setup

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file in the root directory with the following variables:

   ```bash
    # Server port (default: 3000)
    PORT = 3000

    # Ethereum RPC URL (Required!)
    ALCHEMY_RPC_URL=<YOU_RPC_URL>

    # Gas price cache TTL in milliseconds (default: 5000)
    GAS_CACHE_TTL_MS=5000
   ```

3. **Start the Server**:

   ```bash
   # Development mode
   npm run start:dev

   # Production mode
   npm run start:prod
   ```

4. **API Documentation**:
   Once the server is running, you can access the [**Swagger API**](https://swagger.io/) documentation at:
   ```json
    http://localhost:3000/docs
   ```
   The documentation provides:
   - Detailed API endpoint descriptions.
   - Request& response schemas.
   - Interactive API testing interface.

## 🔗 API Flow

### I. Gas Price Endpoint (`/gasPrice`)

This endpoint provides real-time gas price information from the Ethereum network:

1. **Request Flow**:

   - Client makes a GET request to `/gasPrice`.
   - No parameters required.

2. **Processing**:

   - Connects to Ethereum network using Alchemy RPC.
   - Fetches current gas price using **`ethers.provider.getFeeData()`**.
   - Converts gas price from **wei** to **gwei** for better readability.
   - Gas price is cached and refreshed in every **5s** (default), can be changed via **`GAS_CACHE_TTL_MS`** in **`.env`**.

3. **Response**:

   ```json
   GET /gasPrice

   {
     "gasPriceInGwei": "0.555708653"
   }
   ```

### II. Return Estimation Endpoint (`/return/:fromTokenAddress/:toTokenAddress/:amountIn`)

This endpoint calculates the estimated return amount for a token swap on Uniswap V2:

1. **Request Flow**:

   - Client makes a GET request to `/return/{fromTokenAddress}/{toTokenAddress}/{amountIn}`
   - Parameters:
     - `fromTokenAddress`: Source token contract address
     - `toTokenAddress`: Destination token contract address
     - `amountIn`: Amount of source token to swap (as a string)

2. **Processing Steps**:

   a. **Input Validation**:

   - Validates token addresses format.
   - Validates amount is a positive number.
   - Checks if tokens are valid ERC-20 contracts.

   b. **Token Information**:

   - Fetches token decimals and symbols.
   - Caches decimal and symbol data in an LRU cache (size 25) to avoid redundant calls.

   c. **Pair Reserves**:

   - Checks if Uniswap V2 pair exists for the token pair.
   - Fetches current reserves for both tokens.

   d. **Quote Calculation**:

   - Calculates initial quote using constant product formula, x \* y = K.
   - If **_quote would impact reserves by >90%_**, attempts WETH routing:
     1. **First hop**: fromToken **→** WETH
     2. **Second hop**: WETH **→** toToken
   - Applies **`0.3%`** Uniswap fee to final calculation.

3. **Response**:

   ```json
   GET /return/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/1

   {
      "estimatedAmountOut": "41.729090866854752014"
   }
   ```

## 🧪 Testing

| Script               | Description                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run test:debug` | Launch Jest in debug mode with Node.js inspector enabled. Useful for setting breakpoints in tests. |
| `npm run test:e2e`   | Run a suite of **6** end-to-end (e2e) integration tests.                                           |

## 🚫 Restrictions

This project strictly follows certain technical restrictions imposed by the problem statement:

1. Using [**ethers js v5.7.2**](https://docs.ethers.org/v5/) library and [**Alchemy**](https://www.alchemy.com/)'s RPC endpoint for connecting to the Ethereum Mainnet.
2. No usage of any **uniswap** packages/SDK (under the scope of **@uniswap** namespace).
