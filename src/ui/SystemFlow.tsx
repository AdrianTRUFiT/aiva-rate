import React from 'react';
import { useSystemStore } from '../state/systemStore';
import { motion, AnimatePresence } from 'motion/react';
import { SIB } from '../entry/SIB';
import { Acquisition } from '../acquisition/Acquisition';
import { Stabilization } from '../stabilization/Stabilization';
import { Qualification } from '../qualification/Qualification';
import { Routing } from '../routing/Routing';
import { Delivery } from '../delivery/Delivery';

export const SystemFlow = () => {
  const { currentStage } = useSystemStore();

  return (
    <div className="container mx-auto px-4 py-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStage}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
        >
          {currentStage === 'ENTRY' && <SIB />}
          {currentStage === 'ACQUISITION' && <Acquisition />}
          {currentStage === 'STABILIZATION' && <Stabilization />}
          {currentStage === 'QUALIFICATION' && <Qualification />}
          {currentStage === 'ROUTING' && <Routing />}
          {currentStage === 'DELIVERY' && <Delivery />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
