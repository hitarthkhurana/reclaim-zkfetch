import { ReclaimClient } from "@reclaimprotocol/zk-fetch";
import { BrowserProvider, Contract } from "ethers";
import { useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import "./App.css";

// Import the specific methods we need
import { verifyProof, transformForOnchain } from '@reclaimprotocol/js-sdk';

const VERIFIER_CONTRACT_ADDRESS = "0x6E4e27f08FB956CfE66AeA75c256E62d82B87747";
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // Chain ID for Sepolia

const VERIFIER_ABI = [
  {
    inputs: [{
      components: [
        {
          components: [
            { name: "provider", type: "string", internalType: "string" },
            { name: "parameters", type: "string", internalType: "string" },
            { name: "context", type: "string", internalType: "string" }
          ],
          name: "claimInfo",
          type: "tuple",
          internalType: "struct Reclaim.ClaimInfo"
        },
        {
          components: [
            {
              components: [
                { name: "identifier", type: "bytes32", internalType: "bytes32" },
                { name: "owner", type: "address", internalType: "address" },
                { name: "timestampS", type: "uint32", internalType: "uint32" },
                { name: "epoch", type: "uint32", internalType: "uint32" }
              ],
              name: "claim",
              type: "tuple",
              internalType: "struct Reclaim.CompleteClaimData"
            },
            { name: "signatures", type: "bytes[]", internalType: "bytes[]" }
          ],
          name: "signedClaim",
          type: "tuple",
          internalType: "struct Reclaim.SignedClaim"
        }
      ],
      name: "proof",
      type: "tuple",
      internalType: "struct Reclaim.Proof"
    }],
    name: "verifyProof",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    name: "getVerificationStats",
    type: "function",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "lastTime", type: "uint256" },
      { name: "total", type: "uint256" }
    ],
    stateMutability: "view"
  },
  {
    name: "rewardToken",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view"
  },
  {
    name: "reclaimContract",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view"
  }
];

const reclaim = new ReclaimClient(
  process.env.REACT_APP_RECLAIM_APP_ID,
  process.env.REACT_APP_RECLAIM_APP_SECRET
);

function App() {
  const [proofData, setProofData] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [verificationStats, setVerificationStats] = useState(null);

  const checkAndSwitchNetwork = async (provider) => {
    const network = await provider.getNetwork();
    const chainId = "0x" + network.chainId.toString(16);
    
    if (chainId !== SEPOLIA_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: SEPOLIA_CHAIN_ID,
                chainName: 'Sepolia',
                nativeCurrency: {
                  name: 'Sepolia ETH',
                  symbol: 'ETH',
                  decimals: 18
                },
                rpcUrls: ['https://sepolia.infura.io/v3/'],
                blockExplorerUrls: ['https://sepolia.etherscan.io']
              }],
            });
          } catch (addError) {
            throw new Error('Please add Sepolia network to MetaMask');
          }
        } else {
          throw new Error('Please switch to Sepolia network');
        }
      }
      // Refresh provider after network switch
      return new BrowserProvider(window.ethereum);
    }
    return provider;
  };

  // First, let's add proper MetaMask detection and error handling
  const checkMetaMaskAvailability = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast.error('Please install MetaMask or open in MetaMask browser', {
        duration: 5000,
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      });
      return false;
    }
    return true;
  };

  const generateAndVerifyProof = async () => {
    setIsFetching(true);

    try {
      // Check MetaMask first
      const isMetaMaskAvailable = await checkMetaMaskAvailability();
      if (!isMetaMaskAvailable) {
        setIsFetching(false);
        return;
      }

      let provider = new BrowserProvider(window.ethereum);
      
      // Request accounts first
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (connectError) {
        throw new Error('Please connect your wallet first');
      }
      
      // Check and switch to Sepolia if needed
      provider = await checkAndSwitchNetwork(provider);
      
      const signer = await provider.getSigner();
      const contract = new Contract(VERIFIER_CONTRACT_ADDRESS, VERIFIER_ABI, signer);

      const weatherProof = await reclaim.zkFetch(
        "https://api.open-meteo.com/v1/forecast?latitude=37.7749,40.7128&longitude=-122.4194,-74.0060&current=temperature_2m",
        { 
          method: "GET",
          provider: "http"
        },
        {
          responseMatches: [
            {
              type: "regex",
              value: '"current":\\s*\\{[^}]*"temperature_2m":\\s*(?<sf_temp>-?[0-9.]+)\\}\\}',
            },
            {
              type: "regex",
              value: '"current":\\s*\\{[^}]*"temperature_2m":\\s*(?<nyc_temp>-?[0-9.]+)\\}\\}[^{]*$',
            }
          ]
        }
      );

      if (!weatherProof) {
        throw new Error("Failed to generate proof");
      }

      const isVerified = await verifyProof(weatherProof);
      if (!isVerified) {
        throw new Error("Proof verification failed");
      }

      const proofData = transformForOnchain(weatherProof);
      const tx = await contract.verifyProof(proofData);
      const receipt = await tx.wait();

      const [lastTime, total] = await contract.getVerificationStats(await signer.getAddress());
      setVerificationStats({ lastTime: lastTime.toString(), total: total.toString() });

      toast.success("Proof verified and reward claimed!");
      setProofData({ weatherProof });
      setIsFetching(false);

    } catch (error) {
      setIsFetching(false);
      
      let errorMessage = error?.message || "An unknown error occurred";
      
      if (errorMessage.includes("execution reverted:")) {
        errorMessage = errorMessage.split("execution reverted:")[1].trim();
        errorMessage = errorMessage.replace(/^"(.*)"$/, '$1');
        
        if (errorMessage.includes("NYC temperature must be below")) {
          errorMessage = "Claim rejected: New York is too warm (must be below -1°C)";
        } else if (errorMessage.includes("SF temperature must be above")) {
          errorMessage = "Claim rejected: San Francisco is too cold (must be above 10°C)";
        }
      }
      
      toast.error(errorMessage, {
        duration: 15000,
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      });
    }
  };

  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-gray-900 via-blue-900 to-black">
        <div className="w-full max-w-4xl flex flex-col gap-8 items-center justify-center font-sans">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white">
              Temperature Verifier
            </h1>
            <h2 className="text-xl md:text-2xl text-blue-200 max-w-2xl mx-auto">
              Verify SF & NYC temperatures on-chain to earn USDC
            </h2>
            <p className="text-lg text-blue-300 mt-4">
              Requirements:
              <br />
              • San Francisco temperature must be above 10°C (50°F)
              <br />
              • New York temperature must be below -1°C (30°F)
            </p>
          </div>

          {/* Stats Card */}
          {verificationStats && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 w-full max-w-md">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-blue-300 text-sm">Last Verification</p>
                  <p className="text-white text-lg font-semibold">
                    {new Date(verificationStats.lastTime * 1000).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-blue-300 text-sm">Total Verifications</p>
                  <p className="text-white text-lg font-semibold">
                    {verificationStats.total}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            className={`
              ${isFetching ? 'bg-blue-600' : 'bg-blue-500 hover:bg-blue-600'}
              text-white font-bold py-4 px-8 rounded-xl
              shadow-lg transform transition-all duration-300
              hover:scale-105 focus:outline-none focus:ring-2
              focus:ring-blue-500 focus:ring-opacity-50
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            onClick={generateAndVerifyProof}
            disabled={isFetching}
          >
            {isFetching ? (
              <div className="flex items-center space-x-3">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <span>Verifying Temperatures...</span>
              </div>
            ) : (
              "Verify and Claim 1 USDC"
            )}
          </button>

          {/* Proof Data Card */}
          {proofData && !isFetching && (
            <div className="w-full max-w-md bg-white/5 backdrop-blur-lg rounded-xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                Current Temperatures
              </h3>
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center">
                  <p className="text-blue-300 text-sm mb-2">San Francisco</p>
                  <p className="text-4xl font-bold text-white">
                    {proofData.weatherProof.extractedParameterValues.sf_temp}°C
                  </p>
                  <p className="text-blue-200 text-sm">
                    {(proofData.weatherProof.extractedParameterValues.sf_temp * 9/5 + 32).toFixed(1)}°F
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-blue-300 text-sm mb-2">New York</p>
                  <p className="text-4xl font-bold text-white">
                    {proofData.weatherProof.extractedParameterValues.nyc_temp}°C
                  </p>
                  <p className="text-blue-200 text-sm">
                    {(proofData.weatherProof.extractedParameterValues.nyc_temp * 9/5 + 32).toFixed(1)}°F
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default App;
