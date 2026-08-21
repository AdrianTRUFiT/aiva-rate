import { AnimatePresence, motion } from 'motion/react';
import { useSession } from '../state/sessionStore';
import { StageRail } from './StageRail';
import { Threshold } from '../screens/Threshold';
import { SafetyRoute } from '../screens/SafetyRoute';
import { Reflection } from '../screens/Reflection';
import { Education } from '../screens/Education';
import { Action } from '../screens/Action';
import { Checkpoint } from '../screens/Checkpoint';
import { Transformation } from '../screens/Transformation';
import { Offer } from '../screens/Offer';
import { Continuation } from '../screens/Continuation';

/**
 * Renders whichever stage the session is in.
 *
 * The safety check is first and unconditional: a routed session can never reach
 * a stage that runs an exercise or shows an offer, regardless of what stage it
 * was in when the signal fired.
 */
export const SessionFlow = () => {
  const session = useSession((s) => s.session);

  if (session.safetyRouted) return <SafetyRoute />;

  const showRail = session.stage !== 'THRESHOLD';

  return (
    <div>
      {showRail && (
        <div className="max-w-xl mx-auto px-6 pt-8">
          <StageRail stage={session.stage} />
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={`${session.stage}-${session.intervention?.id ?? ''}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28 }}
        >
          {session.stage === 'THRESHOLD' && <Threshold />}
          {session.stage === 'REFLECTION' && <Reflection />}
          {session.stage === 'EDUCATION' && <Education />}
          {session.stage === 'ACTION' && <Action />}
          {session.stage === 'CHECKPOINT' && <Checkpoint />}
          {session.stage === 'TRANSFORMATION' && <Transformation />}
          {session.stage === 'OFFER' && <Offer />}
          {session.stage === 'CONTINUATION' && <Continuation />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
