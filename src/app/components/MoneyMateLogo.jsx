"use client"

import Image from "next/image";

export default function MoneyMateLogo({ className = "", light = false, onClick }) {
  return (
    <div
      className={`moneymate-logo ${light ? "logo-light" : ""} ${className}`.trim()}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick(event);
              }
            }
          : undefined
      }
    >
      <Image
        src="/moneymate-mark.png"
        width={42}
        height={42}
        alt="MoneyMate logo"
        className="moneymate-logo__mark"
        priority
      />
      <span className="moneymate-logo__text">
        <span className="moneymate-logo__word">
          Money<span className="moneymate-logo__mate">Mate</span>
        </span>
        <span className="moneymate-logo__country">THAILAND</span>
      </span>
    </div>
  );
}
