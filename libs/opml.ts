export interface OpmlOutline {
    text: string;
    xmlUrl?: string;
    type?: string;
    category?: string; // Derived from parent folder
    outlines?: OpmlOutline[];
}

export function parseOpml(xmlContent: string): OpmlOutline[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, "text/xml");
    
    const outlines: OpmlOutline[] = [];
    const body = doc.querySelector("body");
    
    if (body) {
        Array.from(body.children).forEach(node => {
            if (node.tagName.toLowerCase() === 'outline') {
                outlines.push(parseOutline(node));
            }
        });
    }
    
    return outlines;
}

function parseOutline(node: Element, parentCategory?: string): OpmlOutline {
    const text = node.getAttribute("text") || node.getAttribute("title") || "";
    const xmlUrl = node.getAttribute("xmlUrl");
    const type = node.getAttribute("type");
    
    const item: OpmlOutline = {
        text,
        xmlUrl: xmlUrl || undefined,
        type: type || undefined,
        category: parentCategory
    };
    
    // Check for children (folders)
    if (node.children.length > 0) {
        item.outlines = [];
        // If it's a folder (no xmlUrl), use its text as category for children
        const currentCategory = xmlUrl ? parentCategory : text;
        
        Array.from(node.children).forEach(child => {
            if (child.tagName.toLowerCase() === 'outline') {
                item.outlines?.push(parseOutline(child, currentCategory));
            }
        });
    }
    
    return item;
}

export function flattenOpml(outlines: OpmlOutline[]): { title: string, url: string, category: string }[] {
    const result: { title: string, url: string, category: string }[] = [];
    
    function traverse(items: OpmlOutline[]) {
        items.forEach(item => {
            if (item.xmlUrl) {
                result.push({
                    title: item.text,
                    url: item.xmlUrl,
                    category: item.category || "Uncategorized"
                });
            }
            if (item.outlines) {
                traverse(item.outlines);
            }
        });
    }
    
    traverse(outlines);
    return result;
}
