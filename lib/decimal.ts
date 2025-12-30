/**
 * Decimal utility for precise calculations
 * Replaces Prisma's Decimal for Supabase-based apps
 */

export class Decimal {
  private value: number

  constructor(value: string | number | Decimal) {
    if (value instanceof Decimal) {
      this.value = value.value
    } else {
      this.value = typeof value === "string" ? Number.parseFloat(value) : value
    }
  }

  // Arithmetic operations
  plus(other: Decimal | number | string): Decimal {
    const otherVal = other instanceof Decimal ? other.value : Number.parseFloat(String(other))
    return new Decimal(this.value + otherVal)
  }

  minus(other: Decimal | number | string): Decimal {
    const otherVal = other instanceof Decimal ? other.value : Number.parseFloat(String(other))
    return new Decimal(this.value - otherVal)
  }

  times(other: Decimal | number | string): Decimal {
    const otherVal = other instanceof Decimal ? other.value : Number.parseFloat(String(other))
    return new Decimal(this.value * otherVal)
  }

  dividedBy(other: Decimal | number | string): Decimal {
    const otherVal = other instanceof Decimal ? other.value : Number.parseFloat(String(other))
    if (otherVal === 0) throw new Error("Division by zero")
    return new Decimal(this.value / otherVal)
  }

  negated(): Decimal {
    return new Decimal(-this.value)
  }

  // Comparison operations
  equals(other: Decimal | number | string): boolean {
    const otherVal = other instanceof Decimal ? other.value : Number.parseFloat(String(other))
    return Math.abs(this.value - otherVal) < Number.EPSILON
  }

  greaterThan(other: Decimal | number | string): boolean {
    const otherVal = other instanceof Decimal ? other.value : Number.parseFloat(String(other))
    return this.value > otherVal
  }

  lessThan(other: Decimal | number | string): boolean {
    const otherVal = other instanceof Decimal ? other.value : Number.parseFloat(String(other))
    return this.value < otherVal
  }

  // Conversion
  toNumber(): number {
    return this.value
  }

  toString(): string {
    return this.value.toString()
  }

  toFixed(decimals: number): string {
    return this.value.toFixed(decimals)
  }
}
