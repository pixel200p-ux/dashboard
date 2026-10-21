import type { BankDeposit, BankRateUpdate, BankView } from "./types";
import { actualDays, addTermMonths, remainingDays, todayYmd } from "./dates";

export function periodRate(
  deposit: BankDeposit,
  periodNumber: number,
  updates: BankRateUpdate[],
): { rate: number; confirmed: boolean } {
  if (periodNumber <= 0) return { rate: deposit.interestRate, confirmed: true };
  const hit = updates.find((u) => u.depositId === deposit.id && u.periodNumber === periodNumber);
  if (hit) return { rate: hit.interestRate, confirmed: true };
  return { rate: deposit.interestRate, confirmed: false };
}

export function interestForPeriod(principal: number, ratePct: number, start: string, end: string): number {
  const days = actualDays(start, end);
  return (principal * (ratePct / 100) * days) / 365;
}

export function replayBank(deposit: BankDeposit, updates: BankRateUpdate[], asOf = todayYmd()): BankView {
  if (
    deposit.status === "REDEEMED" &&
    deposit.redeemedAt &&
    deposit.redeemedAt <= asOf
  ) {
    const interest = deposit.redeemedInterest ?? 0;
    return {
      id: deposit.id,
      bankName: deposit.bankName,
      originalPrincipal: deposit.principal,
      currentPrincipal: 0,
      currentValue: 0,
      startDate: deposit.startDate,
      currentPeriodStart: deposit.startDate,
      maturityDate: deposit.redeemedAt ?? deposit.startDate,
      termMonths: deposit.termMonths,
      currentRate: deposit.interestRate,
      originalRate: deposit.interestRate,
      autoRollover: deposit.autoRollover,
      renewalCount: 0,
      accumulatedInterest: interest,
      remainingDays: 0,
      rateUnconfirmed: false,
      status: "REDEEMED",
      notes: deposit.notes,
    };
  }

  let principal = deposit.principal;
  let periodStart = deposit.startDate;
  let period = 0;
  let accumulated = 0;
  let lastConfirmedRate = deposit.interestRate;

  while (true) {
    const maturity = addTermMonths(periodStart, deposit.termMonths);
    const { rate, confirmed } = periodRate(deposit, period, updates);
    if (confirmed) lastConfirmedRate = rate;

    if (asOf < maturity) {
      const currentPeriodInterest = interestForPeriod(
        principal,
        rate,
        periodStart,
        asOf,
      );
      return {
        id: deposit.id,
        bankName: deposit.bankName,
        originalPrincipal: deposit.principal,
        currentPrincipal: principal,
        currentValue: principal,
        startDate: deposit.startDate,
        currentPeriodStart: periodStart,
        maturityDate: maturity,
        termMonths: deposit.termMonths,
        currentRate: rate,
        originalRate: deposit.interestRate,
        autoRollover: deposit.autoRollover,
        renewalCount: period,
        accumulatedInterest: accumulated + currentPeriodInterest,
        remainingDays: remainingDays(asOf, maturity),
        rateUnconfirmed: period > 0 && !confirmed,
        status: "ACTIVE",
        notes: deposit.notes,
      };
    }

    const earned = interestForPeriod(principal, rate, periodStart, maturity);
    if (!deposit.autoRollover) {
      return {
        id: deposit.id,
        bankName: deposit.bankName,
        originalPrincipal: deposit.principal,
        currentPrincipal: principal,
        currentValue: principal + accumulated + earned,
        startDate: deposit.startDate,
        currentPeriodStart: periodStart,
        maturityDate: maturity,
        termMonths: deposit.termMonths,
        currentRate: rate,
        originalRate: deposit.interestRate,
        autoRollover: false,
        renewalCount: period,
        accumulatedInterest: accumulated + earned,
        remainingDays: Math.max(0, remainingDays(asOf, maturity)),
        rateUnconfirmed: false,
        status: "ACTIVE",
        notes: deposit.notes,
      };
    }

    accumulated += earned;
    principal += earned;
    periodStart = maturity;
    period += 1;
    if (period > 600) break;
  }

  return {
    id: deposit.id,
    bankName: deposit.bankName,
    originalPrincipal: deposit.principal,
    currentPrincipal: principal,
    currentValue: principal,
    startDate: deposit.startDate,
    currentPeriodStart: periodStart,
    maturityDate: addTermMonths(periodStart, deposit.termMonths),
    termMonths: deposit.termMonths,
    currentRate: lastConfirmedRate,
    originalRate: deposit.interestRate,
    autoRollover: deposit.autoRollover,
    renewalCount: period,
    accumulatedInterest: accumulated,
    remainingDays: 0,
    rateUnconfirmed: false,
    status: "ACTIVE",
    notes: deposit.notes,
  };
}
