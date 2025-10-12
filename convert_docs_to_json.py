import json
from docx import Document

def docx_table_to_json(docx_path, json_path):
    doc = Document(docx_path)

    all_tables_data = []

    for table_idx, table in enumerate(doc.tables):
        table_data = []
        headers = []

        # 假設第一列是表頭
        for i, row in enumerate(table.rows):
            row_data = [cell.text.strip() for cell in row.cells]

            if i == 0:
                headers = row_data
            else:
                row_dict = dict(zip(headers, row_data))
                table_data.append(row_dict)

        all_tables_data.append({
            "table_index": table_idx,
            "data": table_data
        })

    # 寫入 JSON
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_tables_data, f, ensure_ascii=False, indent=2)

    print(f"✅ 已將 {docx_path} 的表格轉為 JSON，儲存至 {json_path}")

# ===== 使用範例 =====
if __name__ == "__main__":
    docx_file = "introduction.docx"   # 你的 .docx 檔案
    json_file = "introduction.json"    # 輸出的 JSON 檔
    docx_table_to_json(docx_file, json_file)
