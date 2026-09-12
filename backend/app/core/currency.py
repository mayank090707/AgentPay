"""
Currency utilities and exact Decimal arithmetic for Person 3 (Service Provider Backend).
Enforces native ETH denomination and exact Decimal-to-wei conversions.
Floating-point math is strictly prohibited for blockchain value comparisons.
"""

from decimal import Decimal, InvalidOperation
from typing import Union

WEI_PER_ETH = Decimal(10**18)


def eth_to_wei(amount_eth: Union[Decimal, float, str, int]) -> int:
    """
    Deterministically convert an ETH amount to integer wei using exact Decimal arithmetic.
    Floating-point math is strictly prohibited to prevent rounding exploits.
    """
    try:
        dec = Decimal(str(amount_eth))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Invalid ETH amount '{amount_eth}': cannot parse as Decimal") from exc

    if dec <= 0:
        raise ValueError(f"Payment amount must be positive, got {dec}")

    # Multiply by 10^18 and verify no fractional sub-wei precision
    wei_dec = dec * WEI_PER_ETH
    wei_int = int(wei_dec)
    if Decimal(wei_int) != wei_dec:
        raise ValueError(f"ETH amount '{amount_eth}' has sub-wei precision ({wei_dec})")

    return wei_int
