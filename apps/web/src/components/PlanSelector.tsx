"use client";

import { PLANS, ENTERPRISE_PLAN, getEffectiveSubscription, isProPlan, type PlanDefinition } from "@/lib/subscription/plans";
import type { Subscription, SubscriptionPlan } from "@/lib/profile/types";

export type PlanChoice = SubscriptionPlan | "enterprise";

interface PlanSelectorProps {
  selected: PlanChoice;
  onSelect: (plan: PlanChoice) => void;
  subscription?: Subscription;
  showStatus?: boolean;
  includeEnterprise?: boolean;
}

export function PlanSelector({ selected, onSelect, subscription, showStatus, includeEnterprise }: PlanSelectorProps) {
  const effective = subscription ? getEffectiveSubscription(subscription) : null;

  return (
    <div className={`plan-grid${includeEnterprise ? " plan-grid-4" : ""}`}>
      {PLANS.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          selected={selected === plan.id}
          isCurrent={effective?.selectedPlan === plan.id && (plan.id === "free" ? !effective.isProActive : effective.isProActive)}
          isActive={effective?.isProActive && effective.plan === plan.id}
          showStatus={showStatus}
          onSelect={() => onSelect(plan.id)}
        />
      ))}
      {includeEnterprise && (
        <EnterpriseCard selected={selected === "enterprise"} onSelect={() => onSelect("enterprise")} />
      )}
    </div>
  );
}

function PlanCard({
  plan,
  selected,
  isCurrent,
  isActive,
  showStatus,
  onSelect,
}: {
  plan: PlanDefinition;
  selected: boolean;
  isCurrent?: boolean;
  isActive?: boolean;
  showStatus?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`plan-card${selected ? " plan-card-selected" : ""}${plan.highlighted ? " plan-card-highlighted" : ""}${isCurrent ? " plan-card-current" : ""}`}
      onClick={onSelect}
    >
      {plan.savings && <span className="plan-savings">{plan.savings}</span>}
      {plan.highlighted && <span className="plan-popular">Most Popular</span>}
      {showStatus && isActive && <span className="plan-active-badge">Active</span>}
      {showStatus && isCurrent && !isActive && isProPlan(plan.id) && (
        <span className="plan-pending-badge">Selected — payment required</span>
      )}
      <h3>{plan.name}</h3>
      <div className="plan-price">
        {plan.price === 0 ? (
          <span className="plan-price-amount">$0</span>
        ) : (
          <>
            <span className="plan-price-amount">${plan.price}</span>
            <span className="plan-price-interval">/{plan.interval === "year" ? "yr" : "mo"}</span>
          </>
        )}
      </div>
      <p className="plan-desc">{plan.description}</p>
      <ul className="plan-features">
        {plan.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <span className={`plan-select-indicator${selected ? " selected" : ""}`}>
        {isActive && selected
          ? "✓ Current plan"
          : isActive
            ? "Current plan"
            : selected
              ? "✓ Selected — click Update plan below"
              : showStatus && plan.id !== "free"
                ? "Switch to this plan"
                : plan.id === "free" && showStatus
                  ? "Downgrade option"
                  : "Select plan"}
      </span>
    </button>
  );
}

function EnterpriseCard({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`plan-card plan-card-enterprise${selected ? " plan-card-selected" : ""}`}
      onClick={onSelect}
    >
      <span className="plan-enterprise-badge">Custom pricing</span>
      <h3>{ENTERPRISE_PLAN.name}</h3>
      <div className="plan-price">
        <span className="plan-price-amount plan-price-custom">{ENTERPRISE_PLAN.priceLabel}</span>
      </div>
      <p className="plan-desc">{ENTERPRISE_PLAN.description}</p>
      <ul className="plan-features">
        {ENTERPRISE_PLAN.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <span className={`plan-select-indicator${selected ? " selected" : ""}`}>
        {selected ? "✓ Selected" : "Select plan"}
      </span>
    </button>
  );
}
