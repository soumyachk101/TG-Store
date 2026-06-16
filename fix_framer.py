import re

# Fix Modals.tsx
with open('frontend/components/Modals.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'import { createFolder, renameFile, renameFolder, moveFile, listFolders } from "@/lib/api";',
    'import { createFolder, renameFile, renameFolder, moveFile, listFolders } from "@/lib/api";\nimport { motion, AnimatePresence } from "framer-motion";'
)

# NewFolderModal
content = content.replace(
    '  if (!isOpen) return null;\n\n  const handleSubmit = ',
    '  const handleSubmit = '
)
content = content.replace(
    '  return (\n    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity duration-200">\n      <div className="w-full max-w-md transform rounded-2xl border border-line bg-bg-raised p-6 shadow-2xl transition-all duration-200 scale-100">\n        <div className="flex items-center justify-between border-b border-line pb-3">',
    '''  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-2xl border border-line bg-bg-raised p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">'''
)
content = content.replace(
    '        </form>\n      </div>\n    </div>\n  );\n}\n\ninterface RenameModalProps',
    '        </form>\n          </motion.div>\n        </motion.div>\n      )}\n    </AnimatePresence>\n  );\n}\n\ninterface RenameModalProps'
)

# RenameModal
content = content.replace(
    '  if (!isOpen) return null;\n\n  const handleSubmit = ',
    '  const handleSubmit = ',
    1
)
content = content.replace(
    '  return (\n    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity duration-200">\n      <div className="w-full max-w-md transform rounded-2xl border border-line bg-bg-raised p-6 shadow-2xl transition-all duration-200 scale-100">\n        <div className="flex items-center justify-between border-b border-line pb-3">',
    '''  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-2xl border border-line bg-bg-raised p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">'''
)
content = content.replace(
    '        </form>\n      </div>\n    </div>\n  );\n}\n\ninterface MoveModalProps',
    '        </form>\n          </motion.div>\n        </motion.div>\n      )}\n    </AnimatePresence>\n  );\n}\n\ninterface MoveModalProps'
)

# MoveModal
content = content.replace(
    '  if (!isOpen) return null;\n\n  const navigateTo = ',
    '  const navigateTo = '
)
content = content.replace(
    '  return (\n    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity duration-200">\n      <div className="w-full max-w-md transform rounded-2xl border border-line bg-bg-raised p-6 shadow-2xl transition-all duration-200 scale-100 flex flex-col max-h-[80vh]">\n        <div className="flex items-center justify-between border-b border-line pb-3 shrink-0">',
    '''  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-2xl border border-line bg-bg-raised p-6 shadow-2xl flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between border-b border-line pb-3 shrink-0">'''
)
content = content.replace(
    '          </div>\n        </div>\n      </div>\n    </div>\n  );\n}',
    '          </div>\n        </div>\n          </motion.div>\n        </motion.div>\n      )}\n    </AnimatePresence>\n  );\n}'
)

with open('frontend/components/Modals.tsx', 'w') as f:
    f.write(content)


# Fix LandingPage.tsx
with open('frontend/components/LandingPage.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'import { useEffect, useState } from "react";',
    'import { useEffect, useState } from "react";\nimport { motion } from "framer-motion";'
)

content = content.replace(
    '<section className="w-full mt-32 mb-10 text-center animate-fade-in-up" style={{ animationDelay: "0.3s" }}>',
    '<motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6, ease: "easeOut" }} className="w-full mt-32 mb-10 text-center">'
)
content = content.replace(
    '<section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-16 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>',
    '<motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-16">'
)
content = content.replace(
    '<section className="w-full mt-24 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>',
    '<motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} className="w-full mt-24">'
)
content = content.replace(
    '<section className="w-full mt-32 border-y border-line/50 bg-bg-subtle/30 py-16 text-center animate-fade-in-up" style={{ animationDelay: "0.5s" }}>',
    '<motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }} className="w-full mt-32 border-y border-line/50 bg-bg-subtle/30 py-16 text-center">'
)
content = content.replace('</section>', '</motion.section>')

with open('frontend/components/LandingPage.tsx', 'w') as f:
    f.write(content)

