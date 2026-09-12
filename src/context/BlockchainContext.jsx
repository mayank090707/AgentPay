import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { 
  getContractBudgetDetails, 
  getContractBalance,
  getContractOwner,
  getContractAgent,
  getHardCap,
  executeSetBudget,
  executeFundContract,
  executeWithdraw,
  verifyAuditProof,
  isProcessed as checkIsProcessedService,
  switchEthereumNetwork,
  subscribeToContractEvents,
  isBytes32,
  BLOCKCHAIN_CONFIG,
  isContractConfigured
} from '../services/blockchain';
import { SEPOLIA_CHAIN_ID } from '../config/blockchain.config';

const BlockchainContext = createContext(null);

export function BlockchainProvider({ children }) {
  // Wallet State
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Contract Read State
  const [budget, setBudget] = useState(null);
  const [vaultBalance, setVaultBalance] = useState(null);
  const [contractOwner, setContractOwner] = useState(null);
  const [contractAgent, setContractAgent] = useState(null);
  const [hardCap, setHardCap] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Active Transaction Lifecycle State
  // { type: 'SET_BUDGET' | 'FUND' | 'WITHDRAW', state: 'VALIDATING' | 'AWAITING_SIGNATURE' | 'PENDING' | 'CONFIRMED' | 'FAILED', txHash?: string, receipt?: object, error?: string }
  const [activeTransaction, setActiveTransaction] = useState(null);

  // Live Contract Event Stream (PaymentAuthorized, DeliveryRecorded, BudgetSet, Funded)
  const [liveEvents, setLiveEvents] = useState([]);

  const isConnected = Boolean(account);
  const isCorrectChain = chainId === SEPOLIA_CHAIN_ID;
  const hasContract = isContractConfigured();
  const contractAddress = BLOCKCHAIN_CONFIG.safeContractAddress;

  // Dynamic Owner Check
  const isOwner = Boolean(
    account && 
    contractOwner && 
    account.toLowerCase() === contractOwner.toLowerCase()
  );

  // ── Fetch Contract Data (Read-only via JsonRpcProvider) ─────────────────────
  const refreshData = useCallback(async () => {
    if (!hasContract) {
      setBudget(null);
      setVaultBalance(null);
      setContractOwner(null);
      setContractAgent(null);
      setHardCap(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [budgetDetails, balanceDetails, ownerAddr, agentAddr, hardCapData] = await Promise.all([
        getContractBudgetDetails(),
        getContractBalance(),
        getContractOwner(),
        getContractAgent(),
        getHardCap(),
      ]);

      setBudget(budgetDetails);
      setVaultBalance(balanceDetails);
      setContractOwner(ownerAddr);
      setContractAgent(agentAddr);
      setHardCap(hardCapData);
    } catch (err) {
      console.warn('[BlockchainContext] Could not fetch contract data:', err);
      setError(err?.message || 'Failed to read contract data from Sepolia');
    } finally {
      setIsLoading(false);
    }
  }, [hasContract]);

  // Initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // ── Wallet Connection Handlers ──────────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('No injected Ethereum wallet found. Please install MetaMask.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const currentChainHex = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
      }
      if (currentChainHex) {
        setChainId(parseInt(currentChainHex, 16));
      }
    } catch (err) {
      console.error('[BlockchainContext] connectWallet failed:', err);
      setError(err?.message || 'Wallet connection was rejected');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
  }, []);

  const switchNetwork = useCallback(async () => {
    setError(null);
    try {
      await switchEthereumNetwork();
    } catch (err) {
      console.error('[BlockchainContext] switchNetwork failed:', err);
      setError(err?.message || 'Failed to switch network to Sepolia');
    }
  }, []);

  // ── Window Ethereum Event Listeners ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    window.ethereum.request({ method: 'eth_accounts' })
      .then((accounts) => {
        if (accounts && accounts.length > 0) {
          setAccount(accounts[0]);
        }
      })
      .catch((err) => console.warn('[BlockchainContext] eth_accounts check:', err));

    window.ethereum.request({ method: 'eth_chainId' })
      .then((hex) => {
        if (hex) setChainId(parseInt(hex, 16));
      })
      .catch((err) => console.warn('[BlockchainContext] eth_chainId check:', err));

    const handleAccountsChanged = (accounts) => {
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
      } else {
        setAccount(null);
      }
    };

    const handleChainChanged = (hex) => {
      setChainId(parseInt(hex, 16));
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  // ── Real-Time Contract Event Subscriptions ──────────────────────────────────
  useEffect(() => {
    if (!hasContract) return;

    const unsubscribe = subscribeToContractEvents({
      onPaymentAuthorized: (evt) => {
        setLiveEvents((prev) => {
          const key = `${evt.txHash || ''}-${evt.requestId}`;
          if (prev.some((e) => e.id === key)) return prev;
          return [
            {
              id: key,
              type: 'PaymentAuthorized',
              timestamp: new Date().toLocaleTimeString(),
              requestId: evt.requestId,
              service: evt.service,
              provider: evt.provider,
              amountEth: evt.amountEth,
              totalSpentEth: evt.totalSpentEth,
              remainingBudgetEth: evt.remainingBudgetEth,
              txHash: evt.txHash,
              blockNumber: evt.blockNumber,
            },
            ...prev.slice(0, 49),
          ];
        });
        refreshData();
      },
      onDeliveryRecorded: (evt) => {
        setLiveEvents((prev) => {
          const key = `${evt.txHash || ''}-${evt.requestId}-delivery`;
          if (prev.some((e) => e.id === key)) return prev;
          return [
            {
              id: key,
              type: 'DeliveryRecorded',
              timestamp: new Date().toLocaleTimeString(),
              requestId: evt.requestId,
              contentHash: evt.contentHash,
              txHash: evt.txHash,
            },
            ...prev.slice(0, 49),
          ];
        });
        refreshData();
      },
      onBudgetSet: (evt) => {
        setLiveEvents((prev) => [
          {
            id: `budget-${Date.now()}`,
            type: 'BudgetSet',
            timestamp: new Date().toLocaleTimeString(),
            oldBudgetEth: evt.oldBudgetEth,
            newBudgetEth: evt.newBudgetEth,
          },
          ...prev.slice(0, 49),
        ]);
        refreshData();
      },
      onFunded: (evt) => {
        setLiveEvents((prev) => [
          {
            id: `fund-${Date.now()}`,
            type: 'Funded',
            timestamp: new Date().toLocaleTimeString(),
            by: evt.by,
            amountEth: evt.amountEth,
          },
          ...prev.slice(0, 49),
        ]);
        refreshData();
      },
    });

    // Fallback polling every 20 seconds when contract is configured
    const pollInterval = setInterval(() => {
      refreshData();
    }, 20000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [hasContract, refreshData]);

  // ── Owner Write Action Handlers ─────────────────────────────────────────────

  /**
   * Dispatches setBudget(uint256 amount) with full lifecycle state management.
   * @param {string} budgetEth - New operational budget in ETH (e.g. "0.05")
   */
  const setBudgetAction = useCallback(async (budgetEth) => {
    if (!budgetEth || isNaN(Number(budgetEth)) || Number(budgetEth) <= 0) {
      throw new Error('Please enter a valid positive ETH amount.');
    }

    const budgetWei = ethers.parseEther(budgetEth);

    setActiveTransaction({
      type: 'SET_BUDGET',
      state: 'VALIDATING',
      amountEth: budgetEth,
    });

    try {
      const result = await executeSetBudget(budgetWei, (status) => {
        setActiveTransaction((prev) => ({
          ...prev,
          type: 'SET_BUDGET',
          state: status.state,
          txHash: status.txHash || prev?.txHash,
          receipt: status.receipt,
          error: status.error,
        }));
      });

      await refreshData();
      return result;
    } catch (err) {
      setActiveTransaction((prev) => ({
        ...prev,
        type: 'SET_BUDGET',
        state: 'FAILED',
        error: err.message,
      }));
      throw err;
    }
  }, [refreshData]);

  /**
   * Dispatches payable fund() with full lifecycle state management.
   * @param {string} amountEth - Native ETH to deposit (e.g. "0.1")
   */
  const fundContractAction = useCallback(async (amountEth) => {
    if (!amountEth || isNaN(Number(amountEth)) || Number(amountEth) <= 0) {
      throw new Error('Please enter a valid positive ETH deposit amount.');
    }

    const amountWei = ethers.parseEther(amountEth);

    setActiveTransaction({
      type: 'FUND',
      state: 'VALIDATING',
      amountEth,
    });

    try {
      const result = await executeFundContract(amountWei, (status) => {
        setActiveTransaction((prev) => ({
          ...prev,
          type: 'FUND',
          state: status.state,
          txHash: status.txHash || prev?.txHash,
          receipt: status.receipt,
          error: status.error,
        }));
      });

      await refreshData();
      return result;
    } catch (err) {
      setActiveTransaction((prev) => ({
        ...prev,
        type: 'FUND',
        state: 'FAILED',
        error: err.message,
      }));
      throw err;
    }
  }, [refreshData]);

  /**
   * Dispatches withdraw(uint256 amount) with full lifecycle state management.
   * @param {string} amountEth - Unspent ETH to withdraw (e.g. "0.02")
   */
  const withdrawFundsAction = useCallback(async (amountEth) => {
    if (!amountEth || isNaN(Number(amountEth)) || Number(amountEth) <= 0) {
      throw new Error('Please enter a valid positive ETH withdrawal amount.');
    }

    const amountWei = ethers.parseEther(amountEth);

    setActiveTransaction({
      type: 'WITHDRAW',
      state: 'VALIDATING',
      amountEth,
    });

    try {
      const result = await executeWithdraw(amountWei, (status) => {
        setActiveTransaction((prev) => ({
          ...prev,
          type: 'WITHDRAW',
          state: status.state,
          txHash: status.txHash || prev?.txHash,
          receipt: status.receipt,
          error: status.error,
        }));
      });

      await refreshData();
      return result;
    } catch (err) {
      setActiveTransaction((prev) => ({
        ...prev,
        type: 'WITHDRAW',
        state: 'FAILED',
        error: err.message,
      }));
      throw err;
    }
  }, [refreshData]);

  const dismissTransactionModal = useCallback(() => {
    setActiveTransaction(null);
  }, []);

  // ── Payment & Request Lookups ───────────────────────────────────────────────
  const lookupPayment = useCallback(async (requestId) => {
    if (!hasContract) {
      return {
        isVerifiedOnChain: false,
        reason: 'Contract address is not configured in VITE_CONTRACT_ADDRESS',
      };
    }
    if (!isBytes32(requestId)) {
      return {
        isVerifiedOnChain: false,
        isDemoId: true,
        reason: 'Identifier is not a 32-byte hash (keccak256)',
      };
    }
    return await verifyAuditProof(requestId);
  }, [hasContract]);

  const checkIsProcessed = useCallback(async (requestId) => {
    if (!hasContract || !isBytes32(requestId)) {
      return false;
    }
    return await checkIsProcessedService(requestId);
  }, [hasContract]);

  const value = {
    // Wallet State
    account,
    chainId,
    isConnected,
    isConnecting,
    isCorrectChain,
    expectedChainId: SEPOLIA_CHAIN_ID,
    // Contract Status & Roles
    isContractConfigured: hasContract,
    contractAddress,
    contractOwner,
    contractAgent,
    isOwner,
    hardCap,
    networkName: BLOCKCHAIN_CONFIG.networkName,
    blockExplorerUrl: BLOCKCHAIN_CONFIG.blockExplorerUrl,
    // Live Data & Event Stream
    budget,
    vaultBalance,
    liveEvents,
    clearLiveEvents: () => setLiveEvents([]),
    isLoading,
    error,
    // Active Transaction Lifecycle
    activeTransaction,
    dismissTransactionModal,
    // Actions
    connectWallet,
    disconnectWallet,
    switchNetwork,
    refreshData,
    setBudgetAction,
    fundContractAction,
    withdrawFundsAction,
    lookupPayment,
    checkIsProcessed,
  };

  return (
    <BlockchainContext.Provider value={value}>
      {children}
    </BlockchainContext.Provider>
  );
}

export function useBlockchain() {
  const context = useContext(BlockchainContext);
  if (!context) {
    throw new Error('useBlockchain must be used within a BlockchainProvider');
  }
  return context;
}
