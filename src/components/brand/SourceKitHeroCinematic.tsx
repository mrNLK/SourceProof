import { motion } from "framer-motion";
import { useMemo } from "react";

/**
 * SourceProofHeroCinematic
 *
 * Particle field convergence animation for high-end landing pages.
 * Particles drift, converge toward center, shield assembles.
 * GPU-accelerated: transform + opacity only, no filters.
 *
 * Requires: npm install framer-motion
 * Use in: landing hero, marketing pages.
 *
 * Visual narrative:
 *   particles = latent GitHub signal field
 *   convergence = AI verification
 *   shield = trust lock-in
 *   pulse = live signal
 */
export default function SourceKitHeroCinematic({
  size = 320,
  particleCount = 36,
}) {
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 90 + Math.random() * 40;

      return {
        id: i,
        x: 128 + Math.cos(angle) * radius,
        y: 128 + Math.sin(angle) * radius,
        delay: Math.random() * 1.5,
      };
    });
  }, [particleCount]);

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
      }}
    >
      <motion.svg viewBox="0 0 256 256" width="100%" height="100%">
        {/* PARTICLE FIELD */}
        {particles.map((p) => (
          <motion.circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r="1.6"
            fill="#6366F1"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.6, 0.15],
              cx: [p.x, 128],
              cy: [p.y, 128],
            }}
            transition={{
              duration: 3,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* SHIELD OUTLINE */}
        <motion.path
          d="M128 28L204 60V140C204 190 128 228 128 228C128 228 52 190 52 140V60Z"
          stroke="#6366F1"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: 1.2,
            duration: 0.5,
            repeat: Infinity,
            repeatDelay: 3,
          }}
        />

        {/* CHECKMARK */}
        <motion.polyline
          points="88,132 116,164 172,100"
          stroke="#6366F1"
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ opacity: 0, pathLength: 0 }}
          animate={{ opacity: 1, pathLength: 1 }}
          transition={{
            delay: 1.5,
            duration: 0.4,
            repeat: Infinity,
            repeatDelay: 3,
          }}
        />
      </motion.svg>
    </div>
  );
}
