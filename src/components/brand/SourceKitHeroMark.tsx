import { motion } from "framer-motion";

/**
 * SourceProofHeroMark
 *
 * Staggered reveal animation for marketing hero sections.
 * Sequence: shield outline draws in, checkmark sweeps through,
 * subtle breathing glow.
 *
 * Requires: npm install framer-motion
 * Use in: splash, hero, onboarding. NOT in nav or footer.
 */
export default function SourceKitHeroMark({ size = 140 }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      initial="hidden"
      animate="visible"
    >
      {/* SHIELD OUTLINE */}
      <motion.path
        d="M128 28L204 60V140C204 190 128 228 128 228C128 228 52 190 52 140V60Z"
        stroke="#6366F1"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: {
            pathLength: 1,
            opacity: 1,
            transition: { duration: 0.8, ease: "easeInOut" },
          },
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
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: {
            pathLength: 1,
            opacity: 1,
            transition: { delay: 0.6, duration: 0.5, ease: "easeOut" },
          },
        }}
        animate={{
          scale: [1, 1.04, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.svg>
  );
}
