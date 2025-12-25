import { appendBlock, createDocWithMd, getBlockByID, lsNotebooks, setBlockAttrs, sqlQuery, attributes, deleteBlock } from "./siyuan_api";
import { DEFAULT_CRON } from "./const";

export async function createFeedBlock(parentDocId: string, url: string, category: string = "", cron: string = DEFAULT_CRON) {
    // 1. Create a header block for the feed
    const blockContent = `#### ${url}`; // Ideally we fetch title first, but URL is safe
    const { data } = await appendBlock({
        parentID: parentDocId,
        dataType: "markdown",
        data: blockContent
    });
    
    if (!data || !data[0] || !data[0].doOperations[0]) {
        throw new Error("Failed to create feed block");
    }

    const newBlockId = data[0].doOperations[0].id;

    // 2. Set attributes
    const attrs: { [key: string]: string } = {
        "feed": url,
        "cron": cron
    };
    if (category) {
        attrs["category"] = category;
    }

    await setBlockAttrs(newBlockId, attrs);
    return newBlockId;
}

export async function ensureCategoryDoc(rootDocId: string, category: string): Promise<string> {
    // Check if category doc exists under rootDocId
    // Use SQL query to find child document with title = category
    // Note: blocks table 'content' column holds title for 'd' (document) type blocks
    const query = `SELECT * FROM blocks WHERE parent_id = '${rootDocId}' AND type = 'd' AND content = '${category}' LIMIT 1`;
    const result = await sqlQuery(query);
    
    if (result.data && result.data.length > 0) {
        return result.data[0].id;
    }
    
    // Create new doc
    // First get root doc info to know notebook and path
    const rootDoc = await getBlockByID(rootDocId);
    if (!rootDoc) throw new Error("Root doc not found");

    // Construct path for new doc. Assuming rootDoc path is like /foo/bar.sy
    // New path should be /foo/bar/Category.sy
    const rootPath = rootDoc.path.replace(/\.sy$/, "");
    const newPath = `${rootPath}/${category}.sy`;
    
    const createRes = await createDocWithMd(rootDoc.box, newPath, `# ${category}`);
    if (createRes && createRes.data) {
        return createRes.data;
    }
    console.error("createDocWithMd failed", createRes);
    throw new Error(`Failed to create category doc: ${category}`);
}

export async function deleteFeedBlock(blockId: string) {
    // We might want to just remove the 'feed' attribute or delete the block entirely.
    // Deleting the block is safer for "management".
    // But wait, if the block contains user notes?
    // User requirement is "manage RSS". Deleting the subscription usually implies stopping updates.
    // Let's just remove the attributes for safety, or provide a "delete block" option.
    // For now, let's assume we remove the feed attribute so it stops updating.
    // Or actually, user probably wants to delete the whole entry from the list.
    // Let's offer delete block.
    
    // Actually, siyuan API deleteBlock deletes the block.
    // Let's use that.
    return deleteBlock(blockId);
}
