import urllib.request, json
r = urllib.request.urlopen('http://localhost:8000/api/datasets')
data = json.loads(r.read())
print(f'Datasets: {len(data)}')
if data:
    print(f'First dataset: {data[0]["name"]}, type={data[0]["dataset_type"]}, rows={data[0]["row_count"]}')

r2 = urllib.request.urlopen('http://localhost:8000/api/projects?page_size=3')
proj_data = json.loads(r2.read())
print(f'Total projects: {proj_data["total"]}')
if proj_data['projects']:
    p = proj_data['projects'][0]
    print(f'Top risk: {p["project_id"]} score={p["final_score"]} level={p["risk_level"]}')

r3 = urllib.request.urlopen('http://localhost:8000/api/analytics/summary')
summary = json.loads(r3.read())
print(f'Summary: HIGH={summary["high_risk"]} MEDIUM={summary["medium_risk"]} LOW={summary["low_risk"]}')
print(f'Quality score: {data[0]["data_quality_score"] if data else "N/A"}')
