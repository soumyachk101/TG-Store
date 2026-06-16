with open('frontend/components/LandingPage.tsx', 'r') as f:
    content = f.read()

# Replace all <motion.section> back to <section>
content = content.replace('<motion.section', '<section')
content = content.replace('</motion.section>', '</section>')

# Now specifically target the ones we want
# 1. How it works
content = content.replace(
    '<section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6, ease: "easeOut" }} className="w-full mt-32 mb-10 text-center">',
    '<motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6, ease: "easeOut" }} className="w-full mt-32 mb-10 text-center">'
)

# 2. Bento
content = content.replace(
    '<section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} className="w-full mt-24">',
    '<motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} className="w-full mt-24">'
)

# 3. Trust row
content = content.replace(
    '<section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }} className="w-full mt-32 border-y border-line/50 bg-bg-subtle/30 py-16 text-center">',
    '<motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }} className="w-full mt-32 border-y border-line/50 bg-bg-subtle/30 py-16 text-center">'
)

# Fix the closing tags manually based on occurrence.
# We know that the last 3 sections are the ones we converted.
# Let's just find and replace </section> to </motion.section> for the last 3 occurrences.
parts = content.rsplit('</section>', 3)
content = '</motion.section>'.join(parts)

with open('frontend/components/LandingPage.tsx', 'w') as f:
    f.write(content)
