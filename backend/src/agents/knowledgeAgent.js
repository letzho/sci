const ruleEngine = require('../services/ruleEngine');
const vectorStore = require('../services/vectorStore');

/**
 * Knowledge Agent
 * ---------------
 * Retrieves approved, compliance-cleared talking points from the knowledge
 * base for the text + product context resolved by the NLU Agent. This is
 * the "single source of truth" messaging layer - every channel (face-to-face,
 * virtual call, chat) pulls from the same knowledge base through this agent,
 * which is what keeps messaging consistent across channels.
 *
 * It also blends in chunks from any agent-uploaded reference material - PDFs
 * or pasted URLs, see backend/src/services/documentService.js - when the
 * curated knowledge base doesn't fully cover a question. Curated,
 * pre-approved entries always fill the available slots first - uploaded
 * material only appears when there's room left over - and every result
 * carries a `source` field ('approved' | 'learned') plus `sourceDocument`
 * for learned ones, so the UI and the AI prompt can always be transparent
 * about provenance.
 *
 * Uploaded material is matched two ways: semantic (vector embedding)
 * similarity via vectorStore.semanticSearch when OPENAI_API_KEY is set,
 * falling back to ruleEngine's deterministic word-overlap matcher when it
 * isn't (or when it returns no embeddings yet) - this agent never knows or
 * cares which one actually answered, both return the same shape.
 */

const AGENT_NAME = 'Knowledge Agent';

/**
 * @param {{text: string, productType: ?string, limit?: number}} input
 * @returns {Promise<Array>} matched talking points, approved entries first, highest-scoring within each source
 */
async function findTalkingPoints({ text, productType, limit = 3 }) {
  const approved = await ruleEngine.findTalkingPoints(text, productType, limit);

  let learned = await vectorStore.semanticSearch({ text, productType, limit });
  let learnedVia = 'semantic';
  if (learned === null) {
    learned = await ruleEngine.findLearnedTalkingPoints(text, productType, limit);
    learnedVia = 'keyword';
  }

  const points = [...approved, ...learned].slice(0, limit);

  console.log(
    `[${AGENT_NAME}] retrieved ${approved.length} approved + ${learned.length} learned (via ${learnedVia}) talking point(s) (returning ${points.length}) for productType=${
      productType || 'unscoped'
    }`
  );
  return points;
}

module.exports = { findTalkingPoints, AGENT_NAME };
