// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  AgentPay
 * @notice Autonomous payment contract for the AgentPay hackathon project.
 *         This contract is the SOLE security authority for all spending limits.
 *         No other system component (AI prompt, frontend, backend) may override it.
 *
 * @dev    Architecture decisions (see architecture.md for full rationale):
 *         AD-1  Payment asset: native ETH (wei).
 *         AD-2  authorizePayment both authorizes AND executes the ETH transfer atomically.
 *         AD-3  recordDelivery is called by the AI agent (Person 2) after receiving the
 *               contentHash from Person 3's HTTP delivery response.
 *
 *         Two-tier budget model:
 *         ┌─────────────────────────────────────────────────────────────────┐
 *         │  hardSpendingCap  (immutable — set once in constructor, no setter ever) │
 *         │  ┌─────────────────────────────────────────────────────────┐   │
 *         │  │  budget  (owner-settable via setBudget; ≤ hardSpendingCap)  │   │
 *         │  │  ┌─────────────────────────────────────────────────┐   │   │
 *         │  │  │  totalSpent  (monotonically increasing; ≤ budget)    │   │   │
 *         │  │  └─────────────────────────────────────────────────┘   │   │
 *         │  └─────────────────────────────────────────────────────────┘   │
 *         └─────────────────────────────────────────────────────────────────┘
 *
 *         Security model: Checks-Effects-Interactions + ReentrancyGuard.
 *         All state is updated BEFORE any ETH transfer leaves the contract.
 */
contract AgentPay is ReentrancyGuard {

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Full record for a single payment. Stored in _payments mapping.
     *      contentHash and deliveredAt remain zero until recordDelivery() is called.
     */
    struct PaymentRecord {
        bytes32 requestId;      // echo of the mapping key
        string  service;        // human-readable service label (e.g. "weather-report")
        address provider;       // ETH recipient — Person 3's Sepolia wallet
        uint256 amount;         // wei transferred
        bytes32 contentHash;    // keccak256 of delivery body; zero until recordDelivery()
        uint64  paidAt;         // block.timestamp at authorizePayment
        uint64  deliveredAt;    // block.timestamp at recordDelivery; 0 until then
        bool    delivered;      // true once recordDelivery() succeeds
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Caller is not the owner.
    error NotOwner();

    /// @notice Caller is not the authorised agent.
    error NotAgent();

    /// @notice An address argument is the zero address.
    error ZeroAddress();

    /// @notice A uint256 argument that must be non-zero was zero.
    error ZeroAmount();

    /// @notice contentHash argument is bytes32(0).
    error ZeroContentHash();

    /// @notice The service string argument was empty.
    error EmptyService();

    /// @notice requestId has already been processed; cannot pay twice.
    error AlreadyProcessed(bytes32 requestId);

    /// @notice requestId has not been processed yet; cannot record delivery.
    error NotProcessed(bytes32 requestId);

    /// @notice recordDelivery has already been called for this requestId.
    error AlreadyDelivered(bytes32 requestId);

    /**
     * @notice Payment would cause totalSpent to exceed the operational budget.
     * @param requested  The amount attempted.
     * @param remaining  Budget remaining before this payment attempt.
     */
    error BudgetExceeded(uint256 requested, uint256 remaining);

    /**
     * @notice Defense-in-depth: payment would exceed the absolute hard cap.
     *         Normally unreachable because budget <= hardSpendingCap is maintained,
     *         so BudgetExceeded fires first. Kept as a last-resort safety wall.
     * @param requested          The amount attempted.
     * @param hardCapRemaining   Hard cap remaining before this payment attempt.
     */
    error HardCapExceeded(uint256 requested, uint256 hardCapRemaining);

    /**
     * @notice setBudget() was called with an amount exceeding the hard cap.
     * @param attempted  The budget value attempted.
     * @param hardCap    The immutable ceiling.
     */
    error BudgetExceedsHardCap(uint256 attempted, uint256 hardCap);

    /**
     * @notice setBudget() was called with an amount below totalSpent.
     *         Cannot lower the budget below what has already been spent.
     * @param attempted  The budget value attempted.
     * @param spent      Current totalSpent.
     */
    error BudgetBelowSpent(uint256 attempted, uint256 spent);

    /**
     * @notice The contract's ETH balance is insufficient for the requested amount.
     * @param requested  Amount needed.
     * @param available  Amount available in contract.
     */
    error InsufficientContractBalance(uint256 requested, uint256 available);

    /// @notice A low-level ETH transfer via .call{value}() returned false.
    error TransferFailed();

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when the owner changes the operational budget.
    event BudgetSet(uint256 oldBudget, uint256 newBudget);

    /**
     * @notice Emitted when a payment is authorised and executed.
     * @param requestId       Unique payment identifier.
     * @param service         Service label.
     * @param provider        ETH recipient.
     * @param amount          Wei transferred.
     * @param totalSpent      Cumulative spend after this payment.
     * @param remainingBudget Budget remaining after this payment (budget − totalSpent).
     */
    event PaymentAuthorized(
        bytes32 indexed requestId,
        string          service,
        address indexed provider,
        uint256         amount,
        uint256         totalSpent,
        uint256         remainingBudget
    );

    /// @notice Emitted when delivery proof is recorded on-chain.
    event DeliveryRecorded(bytes32 indexed requestId, bytes32 contentHash);

    /// @notice Emitted when ETH is deposited into the contract.
    event Funded(address indexed by, uint256 amount);

    /// @notice Emitted when the authorised agent address is changed.
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);

    /// @notice Emitted when the owner withdraws unspent ETH.
    event Withdrawn(address indexed to, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────
    // State Variables
    // ─────────────────────────────────────────────────────────────────────────

    // ── Roles ─────────────────────────────────────────────────────────────────
    address public owner;
    address public agent;

    // ── Two-tier budget ───────────────────────────────────────────────────────
    /// @notice Absolute ceiling. Set once in constructor. Cannot be changed. Ever.
    uint256 public immutable hardSpendingCap;

    /// @notice Operational limit. Owner-settable. Must always satisfy:
    ///         budget <= hardSpendingCap  AND  budget >= totalSpent.
    uint256 public budget;

    // ── Spend tracking ────────────────────────────────────────────────────────
    /// @notice Monotonically increasing sum of all confirmed payments (wei).
    uint256 public totalSpent;

    // ── Payment records ───────────────────────────────────────────────────────
    /// @dev Source of idempotency truth. Set to true in EFFECTS, before ETH transfer.
    mapping(bytes32 => bool)          private _processed;

    /// @dev Full per-payment audit record.
    mapping(bytes32 => PaymentRecord) private _payments;

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _agent           EOA address of the AI agent (Person 2).
     * @param _hardSpendingCap Absolute maximum lifetime spend in wei. Immutable.
     *
     * @dev  budget is initialised equal to hardSpendingCap so the contract is
     *       immediately usable without requiring a setBudget() call.
     *       The owner may lower it via setBudget() before the agent is activated.
     */
    constructor(address _agent, uint256 _hardSpendingCap) {
        if (_agent == address(0)) revert ZeroAddress();
        if (_hardSpendingCap == 0) revert ZeroAmount();

        owner           = msg.sender;
        agent           = _agent;
        hardSpendingCap = _hardSpendingCap;
        budget          = _hardSpendingCap; // default: budget = hard cap
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Owner Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Set the operational spending budget.
     *
     * @dev    Enforced constraints:
     *         1. amount must be > 0.
     *         2. amount must be <= hardSpendingCap  (cannot raise above the ceiling).
     *         3. amount must be >= totalSpent        (cannot lower below already spent).
     *
     *         This maps directly to the project guide's setBudget() interface.
     *
     * @param amount New budget in wei.
     */
    function setBudget(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (amount > hardSpendingCap) revert BudgetExceedsHardCap(amount, hardSpendingCap);
        if (amount < totalSpent)      revert BudgetBelowSpent(amount, totalSpent);

        uint256 old = budget;
        budget = amount;
        emit BudgetSet(old, amount);
    }

    /**
     * @notice Deposit ETH into the contract so it can make payments.
     * @dev    Any address may fund the contract; only the owner can withdraw.
     */
    function fund() external payable {
        if (msg.value == 0) revert ZeroAmount();
        emit Funded(msg.sender, msg.value);
    }

    /**
     * @notice Replace the authorised agent EOA.
     * @dev    Does NOT affect previously processed requestIds.
     * @param _newAgent New agent address.
     */
    function setAgent(address _newAgent) external onlyOwner {
        if (_newAgent == address(0)) revert ZeroAddress();
        address old = agent;
        agent = _newAgent;
        emit AgentUpdated(old, _newAgent);
    }

    /**
     * @notice Withdraw unspent ETH to the owner's address.
     * @param amount Wei to withdraw.
     */
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (address(this).balance < amount)
            revert InsufficientContractBalance(amount, address(this).balance);

        // Interaction after state read — no state to update here (owner is not totalSpent)
        (bool ok, ) = owner.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(owner, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Agent Functions — Payment Path
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Authorise AND execute a payment to a service provider.
     *
     * @dev    This is the critical security path. Six checks must pass:
     *         1. requestId not already processed     (idempotency — S4)
     *         2. amount > 0
     *         3. provider != address(0)
     *         4. service string non-empty
     *         5. totalSpent + amount <= budget        (operational limit — S2)
     *         6. totalSpent + amount <= hardSpendingCap (hard cap — S1, defense-in-depth)
     *         7. contract has sufficient ETH balance
     *
     *         Pattern: Checks → Effects → Interactions (CEI).
     *         _processed[requestId] is set TRUE in the Effects phase, BEFORE the ETH
     *         transfer, so a reentrant call will hit AlreadyProcessed on re-entry.
     *         ReentrancyGuard provides a second, independent layer of protection.
     *
     * @param requestId  Unique identifier. bytes32 = keccak256 of a UUID/string.
     * @param amount     Payment in wei.
     * @param provider   Person 3's Sepolia wallet that receives the ETH.
     * @param service    Human-readable service label (e.g. "weather-report").
     */
    function authorizePayment(
        bytes32         requestId,
        uint256         amount,
        address         provider,
        string calldata service
    ) external onlyAgent nonReentrant {

        // ── Checks ────────────────────────────────────────────────────────────
        if (_processed[requestId])            revert AlreadyProcessed(requestId);
        if (amount == 0)                      revert ZeroAmount();
        if (provider == address(0))           revert ZeroAddress();
        if (bytes(service).length == 0)       revert EmptyService();

        uint256 newSpent = totalSpent + amount;
        uint256 budgetSnapshot = budget; // cache — avoids double SLOAD in event emission

        if (newSpent > budgetSnapshot)
            revert BudgetExceeded(amount, budgetSnapshot - totalSpent);

        // Defense-in-depth: normally unreachable because budget <= hardSpendingCap.
        // Kept as an absolute last wall in case of an unforeseen budget accounting bug.
        if (newSpent > hardSpendingCap)
            revert HardCapExceeded(amount, hardSpendingCap - totalSpent);

        if (address(this).balance < amount)
            revert InsufficientContractBalance(amount, address(this).balance);

        // ── Effects ───────────────────────────────────────────────────────────
        _processed[requestId] = true;
        totalSpent = newSpent;
        _payments[requestId] = PaymentRecord({
            requestId:   requestId,
            service:     service,
            provider:    provider,
            amount:      amount,
            contentHash: bytes32(0),
            paidAt:      uint64(block.timestamp),
            deliveredAt: 0,
            delivered:   false
        });

        // ── Interactions ──────────────────────────────────────────────────────
        (bool ok, ) = provider.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit PaymentAuthorized(
            requestId,
            service,
            provider,
            amount,
            newSpent,
            budgetSnapshot - newSpent
        );
    }

    /**
     * @notice Record the delivery proof (content hash) for a completed payment.
     *
     * @dev    Called by the agent after receiving the delivery from Person 3.
     *         Person 3 supplies the contentHash in the HTTP delivery response.
     *         The agent records it here, linking payment evidence to delivery evidence
     *         permanently on-chain.
     *
     *         No ETH transfer — ReentrancyGuard not required.
     *
     * @param requestId   Must match a previously processed requestId.
     * @param contentHash keccak256 digest of the service delivery body.
     */
    function recordDelivery(bytes32 requestId, bytes32 contentHash) external onlyAgent {
        if (!_processed[requestId])               revert NotProcessed(requestId);
        if (_payments[requestId].delivered)        revert AlreadyDelivered(requestId);
        if (contentHash == bytes32(0))             revert ZeroContentHash();

        _payments[requestId].contentHash = contentHash;
        _payments[requestId].delivered   = true;
        _payments[requestId].deliveredAt = uint64(block.timestamp);

        emit DeliveryRecorded(requestId, contentHash);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View / Read Functions
    // Public read surface — callable by anyone (agent, backend, frontend, Etherscan).
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the current operational budget (wei).
     * @dev    Project guide function — preserved exactly.
     */
    function getBudget() external view returns (uint256) {
        return budget;
    }

    /**
     * @notice Returns the total amount spent so far (wei).
     * @dev    Project guide function — preserved exactly.
     */
    function getSpent() external view returns (uint256) {
        return totalSpent;
    }

    /**
     * @notice Returns the remaining spendable amount under the current budget (wei).
     * @dev    Project guide function — preserved exactly.
     *         Returns budget - totalSpent. If budget == 0 and totalSpent == 0 → 0.
     */
    function getRemaining() external view returns (uint256) {
        return budget - totalSpent;
    }

    /**
     * @notice Returns true if the requestId has been processed (paid).
     * @dev    Project guide function — preserved exactly.
     *         Person 2 MUST call this before every authorizePayment to implement
     *         safe retry without double-charge.
     * @param requestId The unique payment identifier to check.
     */
    function isProcessed(bytes32 requestId) external view returns (bool) {
        return _processed[requestId];
    }

    /**
     * @notice Returns the full PaymentRecord for a given requestId.
     * @dev    Returns an all-zero struct if requestId has never been processed.
     * @param requestId The unique payment identifier.
     */
    function getPayment(bytes32 requestId) external view returns (PaymentRecord memory) {
        return _payments[requestId];
    }

    /**
     * @notice Returns the delivery content hash for a requestId.
     * @dev    Returns bytes32(0) if recordDelivery() has not yet been called.
     * @param requestId The unique payment identifier.
     */
    function getDeliveryHash(bytes32 requestId) external view returns (bytes32) {
        return _payments[requestId].contentHash;
    }

    /**
     * @notice Returns the immutable hard spending cap (wei).
     * @dev    Useful for Person 4's dashboard "Hard Cap" security badge.
     */
    function getHardCap() external view returns (uint256) {
        return hardSpendingCap;
    }

    /**
     * @notice Returns the contract's current ETH balance (wei).
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Returns all four budget dimensions in one call.
     * @dev    Convenience function for Person 4's dashboard. Avoids four separate calls.
     * @return hardCap   The immutable hard cap.
     * @return _budget   The current operational budget.
     * @return spent     Total spent so far.
     * @return remaining Budget remaining (budget − totalSpent).
     */
    function getBudgetStatus()
        external
        view
        returns (
            uint256 hardCap,
            uint256 _budget,
            uint256 spent,
            uint256 remaining
        )
    {
        hardCap   = hardSpendingCap;
        _budget   = budget;
        spent     = totalSpent;
        remaining = budget - totalSpent;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Fallback — accept plain ETH transfers (e.g. direct top-up)
    // ─────────────────────────────────────────────────────────────────────────

    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }
}
