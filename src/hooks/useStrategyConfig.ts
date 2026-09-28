import { useCallback, useEffect, useState } from 'react';
import type { StrategyOptimizationConfig } from '../engine/strategyOptimizerEngine';
import { DEFAULT_STRATEGY_CONFIG, recalculateEvaluationsWithConfig } from '../engine/strategyOptimizerEngine';

export function useStrategyConfig(
  evaluations: any[],
  setEvaluations: (evaluations: any[]) => void
) {
  const [strategyConfig, setStrategyConfigState] = useState<StrategyOptimizationConfig>(() => {
    try {
      const saved = localStorage.getItem('quant_strategy_config_v8');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_STRATEGY_CONFIG;
  });

  useEffect(() => {
    if (strategyConfig.id !== DEFAULT_STRATEGY_CONFIG.id) {
      const updated = recalculateEvaluationsWithConfig(evaluations, strategyConfig);
      setEvaluations(updated);
      try {
        localStorage.setItem('quant_evaluations_cache_v8', JSON.stringify(updated));
      } catch (e) {}
    }
  }, [strategyConfig, evaluations]);

  const handleApplyStrategyConfig = useCallback((newConfig: StrategyOptimizationConfig) => {
    setStrategyConfigState(newConfig);
    try {
      localStorage.setItem('quant_strategy_config_v8', JSON.stringify(newConfig));
    } catch (e) {}

    const updated = recalculateEvaluationsWithConfig(evaluations, newConfig);
    setEvaluations(updated);
    try {
      localStorage.setItem('quant_evaluations_cache_v8', JSON.stringify(updated));
    } catch (e) {}
  }, [evaluations, setEvaluations]);

  return {
    strategyConfig,
    setStrategyConfig: handleApplyStrategyConfig,
  };
}