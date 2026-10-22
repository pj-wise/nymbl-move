# Staffing challenge: sample data

This is the data for your Design Engineer challenge. It describes **Harbor & Pine**, a made-up services firm. Every person, client and number here is fictional.

The dataset covers one 25-person practice inside a 100-person firm. Treat **Monday, November 2, 2026** as "today".

Like real operational data, it isn't perfectly clean. How you handle that is part of the work.

## Files

You get the same data in two formats. Use whichever suits your stack.

- `staffing_data.json`: everything in one file
- The CSV files listed below, one per table

| File | What it holds |
|---|---|
| `people.csv` | 25 people: role, level, employment type, weekly capacity in hours, location, skills |
| `projects.csv` | 8 projects: client, status, priority, dates |
| `assignments.csv` | Who is on what project, and at what % of their capacity, for which dates |
| `open_roles.csv` | Roles that projects still need to fill |
| `time_off.csv` | Vacation, training and leave |
| `holidays.csv` | Company holidays |
| `hours_logged.csv` | Hours people actually logged in the last 4 weeks |

## Field notes

- **weekly_capacity_hours**: what a person is available for in a normal week. Full-time staff are 40 hours. Part-time staff and contractors have less.
- **allocation_pct**: the share of a person's weekly capacity that's planned for a project. For example, 50% of 40 hours is 20 hours.
- **assignment status**:
  - **Confirmed** means committed.
  - **Tentative** means the work only happens if a proposed project is won.
- **project status**: one of Active, Starting soon, Wrapping up, Proposed or Internal.
  - **Proposed** projects carry a `win_probability_pct`.
  - **Internal** projects are lower priority, and people can be moved off them for client work.
- **open_roles.priority**: one of Must fill, Nice to fill, or If won (needed only if a proposed project closes).
- **Dates** use ISO format (YYYY-MM-DD). Weeks run Monday to Friday.
- **skills**: semicolon-separated in the CSVs, arrays in the JSON.

## Ground rules

- You can add fields, derive values or restructure the data. If you do, note it in your decision log.
- If something in the data looks wrong, decide how your design should handle it. Don't silently fix it.
