import { tabs } from "@/app/_components/transfer/constants";
import type { TabKey } from "@/app/_components/transfer/types";

type TabSwitcherProps = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
};

export function TabSwitcher({ activeTab, onChange }: TabSwitcherProps) {
  return (
    <div className="mb-8 flex justify-center">
      <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
        {tabs.map((tab) => {
          const active = tab.key === activeTab;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`min-w-28 rounded-full px-6 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-white text-slate-950"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
