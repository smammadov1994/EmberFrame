# /// script
# requires-python = ">=3.10"
# dependencies = ["pgserver>=0.1.4", "psycopg[binary]>=3.1"]
# ///
"""Run the Emberframe migrations on a throwaway Postgres and check the rules hold.
Supabase's own pieces (auth.users, auth.uid(), the three roles, storage) are stubbed the way Supabase defines them."""
import json, sys, tempfile, uuid
from pathlib import Path
import pgserver, psycopg

MIG = Path(sys.argv[1])
A, B = str(uuid.uuid4()), str(uuid.uuid4())
STUBS = """
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant select, insert, delete on storage.objects to authenticated;
grant all on all tables in schema public to service_role;
"""
results = []
def check(name, ok, detail=""):
    results.append(ok); print(("PASS  " if ok else "FAIL  ") + name + (f"   [{detail}]" if detail else ""))

with tempfile.TemporaryDirectory() as d:
    db = pgserver.get_server(d)
    with psycopg.connect(db.get_uri(), autocommit=True) as con:
        print("postgres", con.execute("show server_version").fetchone()[0])
        con.execute(STUBS)
        for f in sorted(MIG.glob("*.sql")):
            con.execute(f.read_text()); print("applied", f.name)
        con.execute("grant all on all tables in schema public to service_role; grant usage, select on all sequences in schema public to service_role")

        def as_user(uid, sql, params=None, fetch=True):
            """One statement as a signed-in person, in its own transaction, the way a request arrives."""
            with con.transaction():
                con.execute("set local role authenticated")
                con.execute("select set_config('request.jwt.claim.sub', %s, true)", (uid,))
                cur = con.execute(sql, params)
                return cur.fetchall() if fetch and cur.description else None
        def denied(uid, sql, params=None):
            try:
                as_user(uid, sql, params); return None
            except psycopg.Error as e:
                return f"{e.sqlstate} {str(e).splitlines()[0][:70]}"
        one = lambda sql, params=None: con.execute(sql, params).fetchone()[0]

        # 1. signing up makes a profile and a subscription row
        con.execute("insert into auth.users (id, email, raw_user_meta_data) values (%s, 'a@example.test', '{\"full_name\": \"Ada\"}'), (%s, 'b@example.test', '{}')", (A, B))
        check("sign-up creates profile and subscription", one("select count(*) from profiles") == 2 and one("select count(*) from subscriptions") == 2
              and one("select display_name from profiles where id = %s", (A,)) == "Ada")

        # 2. one person, many projects; one project, many chats
        p1 = as_user(A, "select new_project('First video')")[0][0]
        p2 = as_user(A, "select new_project('Second video')")[0][0]
        check("new project starts with one chat and one board, empty cut",
              as_user(A, "select (select count(*) from chats where project_id = %s), (select count(*) from boards where project_id = %s), (select count(*) from clips where project_id = %s)", (p1, p1, p1))[0] == (1, 1, 0))
        as_user(A, "insert into chats (project_id, title) values (%s, 'A clean chat about the same video')", (p1,))
        check("a second chat lives in the same project", as_user(A, "select count(*) from chats where project_id = %s", (p1,))[0][0] == 2
              and as_user(A, "select count(*) from projects")[0][0] == 2)

        # 3. another person sees and touches nothing
        check("other person sees no projects, chats or boards", as_user(B, "select (select count(*) from projects), (select count(*) from chats), (select count(*) from boards)")[0] == (0, 0, 0))
        r = denied(B, "insert into chats (project_id, title) values (%s, 'sneak')", (p1,))
        check("other person cannot add a chat to someone's project", bool(r), r or "it was allowed")
        as_user(B, "update projects set name = 'mine now' where id = %s", (p1,))
        check("other person's update changes nothing", one("select name from projects where id = %s", (p1,)) == "First video")
        r = denied(B, "select save_timeline(%s, 0, '[]', '[]')", (p1,))
        check("other person cannot save someone's cut", bool(r), r or "it was allowed")
        def anon(sql):                                         # a visitor who is not signed in arrives as the anon role
            try:
                with con.transaction():
                    con.execute("set local role anon"); con.execute(sql)
                return None
            except psycopg.Error as e:
                return f"{e.sqlstate} {str(e).splitlines()[0][:60]}"
        r = [anon(q) for q in ("select count(*) from projects", "select count(*) from ledger", "select new_project('x')", "select count(*) from profiles")]
        check("a signed-out visitor is refused on every table and function", all(r), "; ".join(x or "ALLOWED" for x in r)[:150])
        check("a signed-in request with no user id sees nothing", as_user("", "select count(*) from projects")[0][0] == 0)

        # 4. the cut: saved whole, refused when stale, never half-written
        con.execute("set role service_role")
        a1 = one("insert into assets (project_id, kind, source, name, storage_path, duration_s) values (%s, 'video', 'upload', 'Take 1', %s, 10) returning id", (p1, f"{A}/{p1}/take1.mp4"))
        a2 = one("insert into assets (project_id, kind, source, name, storage_path, duration_s) values (%s, 'video', 'upload', 'Other project take', %s, 8) returning id", (p2, f"{A}/{p2}/take.mp4"))
        check("an asset's owner is copied from its project", one("select owner_id::text from assets where id = %s", (a1,)) == A)
        con.execute("reset role")
        clip = lambda asset, pos: {"track": "video", "asset_id": str(asset), "position": pos, "in_s": 0, "out_s": 4}
        rev = as_user(A, "select save_timeline(%s, 0, %s, %s, 'First save')", (p1, json.dumps([clip(a1, 0), clip(a1, 1)]), json.dumps([{"start_s": 0, "end_s": 1.2, "body": "Hello"}])))[0][0]
        check("saving the cut writes clips, captions and a version together", rev == 1 and one("select count(*) from clips where project_id = %s", (p1,)) == 2
              and one("select count(*) from captions where project_id = %s", (p1,)) == 1 and one("select count(*) from project_versions where project_id = %s", (p1,)) == 1)
        r = denied(A, "select save_timeline(%s, 0, %s, '[]')", (p1, json.dumps([clip(a1, 0)])))
        check("a save from stale data is refused and changes nothing", bool(r) and r.startswith("40001") and one("select count(*) from clips where project_id = %s", (p1,)) == 2, r or "")
        r = denied(A, "select save_timeline(%s, 1, %s, '[]')", (p1, json.dumps([clip(a1, 0), clip(a2, 1)])))
        check("a clip cannot use another project's asset, and the failed save rolls back whole",
              bool(r) and r.startswith("23503") and one("select count(*) from clips where project_id = %s", (p1,)) == 2 and one("select revision from projects where id = %s", (p1,)) == 1, r or "")
        r = denied(A, "select save_timeline(%s, 1, %s, '[]')", (p1, json.dumps([{**clip(a1, 0), "out_s": 0}])))
        check("a clip with no length is refused", bool(r) and r.startswith("23514"), r or "")

        # 5. money, jobs and the model's transcript are the server's to write
        for name, sql, params in [
            ("person cannot write to the ledger", "insert into ledger (owner_id, kind, cents) values (%s, 'topup', 100000)", (A,)),
            ("person cannot create a render job", "insert into jobs (project_id, kind) values (%s, 'clip')", (p1,)),
            ("person cannot mark a job done or change its cost", "update jobs set cost_cents = 0", None),
            ("person cannot read the model's transcript", "select count(*) from chat_state", None),
            ("person cannot change their plan", "update subscriptions set plan = 'creator_pro', avatar_limit = 99", None),
            ("person cannot add library files behind the server's back", "insert into assets (project_id, kind, source, name, storage_path) values (%s, 'video', 'upload', 'x', 'x')", (p1,)),
        ]:
            r = denied(A, sql, params); check(name, bool(r), r or "it was allowed")
        con.execute("set role service_role")
        j = one("insert into jobs (project_id, kind, seconds, approved_cents) values (%s, 'clip', 8, 32) returning id", (p1,))
        for name, sql, params in [
            ("a job can never cost more than the price that was agreed", "update jobs set cost_cents = 40 where id = %s", (j,)),
            ("an export without the AI label cannot exist", "insert into exports (project_id, storage_path, duration_s, size_bytes, ai_label) values (%s, 'e.mp4', 8, 1000, false)", (p1,)),
            ("a post without the disclosure cannot exist", "insert into posts (project_id, disclosure) values (%s, false)", (p1,)),
        ]:
            try:
                con.execute(sql, params); check(name, False, "it was allowed")
            except psycopg.Error as e:
                check(name, e.sqlstate == "23514", e.sqlstate)
        con.execute("insert into ledger (owner_id, kind, cents) values (%s, 'topup', 1000)", (A,))
        con.execute("update jobs set status = 'done', cost_cents = 32, finished_at = now() where id = %s", (j,))
        con.execute("insert into ledger (owner_id, kind, cents, job_id) values (%s, 'render', -32, %s)", (A, j))
        try:
            con.execute("insert into ledger (owner_id, kind, cents, job_id) values (%s, 'render', -32, %s)", (A, j)); check("a job is charged once", False)
        except psycopg.Error as e:
            check("a job is charged once", e.sqlstate == "23505", e.sqlstate)
        con.execute("reset role")
        check("a person reads their own balance and nobody else's", as_user(A, "select cents from balances")[0][0] == 968 and as_user(B, "select count(*) from balances")[0][0] == 0)

        # 6. avatars follow the plan
        as_user(A, "insert into avatars (name, image_path) values ('Me', %s)", (f"{A}/avatars/me.jpg",))
        r = denied(A, "insert into avatars (name, image_path) values ('Second', %s)", (f"{A}/avatars/two.jpg",))
        check("the plan's avatar limit holds", bool(r) and r.startswith("23514"), r or "it was allowed")
        con.execute("update subscriptions set plan = 'creator_pro', avatar_limit = 5 where owner_id = %s", (A,))
        check("a bigger plan allows more avatars", denied(A, "insert into avatars (name, image_path) values ('Second', %s)", (f"{A}/avatars/two.jpg",)) is None)

        # 7. files: only inside your own folder
        check("a person can add a file under their own folder", denied(A, "insert into storage.objects (bucket_id, name) values ('media', %s)", (f"{A}/{p1}/clip.mp4",)) is None)
        r = denied(A, "insert into storage.objects (bucket_id, name) values ('media', %s)", (f"{B}/x/clip.mp4",))
        check("a person cannot add a file under someone else's folder", bool(r), r or "it was allowed")
        check("a person cannot see someone else's files", as_user(B, "select count(*) from storage.objects")[0][0] == 0)

        # 8. deleting a project, or an account, takes everything under it
        as_user(A, "delete from projects where id = %s", (p2,))
        check("deleting a project removes its assets, chats and boards", one("select (select count(*) from assets where project_id = %s) + (select count(*) from chats where project_id = %s)", (p2, p2)) == 0)
        con.execute("delete from auth.users where id = %s", (A,))
        left = one("select (select count(*) from projects) + (select count(*) from assets) + (select count(*) from clips) + (select count(*) from chats) + (select count(*) from ledger) + (select count(*) from avatars) + (select count(*) from jobs)")
        check("deleting the account removes every row that was theirs", left == 0, f"{left} rows left")
    db.cleanup()
print(f"\n{sum(results)} of {len(results)} checks passed")
sys.exit(0 if all(results) else 1)
