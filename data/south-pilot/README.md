# Phase 5.3A 南部 POI 試行產物

此目錄只提交說明與摘要。完整列檔（ndjson／gzip）留在本機，不進 GitHub。

```bash
npm run export:south-pois   # Dry Run，不連線寫庫
npm run test:south-pois
npm run verify:south-pois
npm run import:south-pois   # 預設仍是 dry-run
```

正式寫入需要人工確認的 NavPilot Supabase 專案，以及：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SOUTH_POI_APPLY=1`

未確認專案前不得寫入，也不得自建可能產生費用的新專案。

## 門牌 staging

```bash
npm run build:address-index      # NLSC 衍生，不是官方縣市門牌檔
npm run import:doorplates        # 預設 dry-run
npm run reconstruct:nlsc-fails
npm run retry:nlsc-fails         # 單次重打；不寫雲端
npm run advise:address
```

`ADDRESS_DOORPLATES_DIR` 放 `{縣市}.csv|json|geojson` 才會標 `official-county-file`。
`ADDRESS_INDEX_APPLY=1` 在專案未確認前仍會拒絕寫 `taiwan_address_index`。
