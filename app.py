import streamlit as st
from supabase import create_client
from dotenv import load_dotenv
import os, uuid, random, string, datetime

# Config / Secrets
load_dotenv()  

SUPABASE_URL = os.getenv("SUPABASE_URL") or st.secrets.get("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or st.secrets.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    st.error("Missing SUPABASE_URL or SUPABASE_KEY in .env or Streamlit secrets.")
    st.stop()

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Helpers
def gen_code(n=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=n))

def now_date():
    return datetime.date.today().isoformat()

def upload_to_bucket(bucket, uploaded_file, prefix=""):
    """Uploads a streamlit UploadedFile to Supabase storage bucket and returns public URL"""
    ext = os.path.splitext(uploaded_file.name)[1]
    fname = f"{prefix}{uuid.uuid4().hex}{ext}"
    data = uploaded_file.read()
    supabase.storage.from_(bucket).upload(fname, data)
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{fname}"

# --- Users'login' by username ---
def create_or_get_user(username):
    username = username.strip()
    if not username:
        return None
    
    # First, check if user exists
    q = supabase.table("users").select("*").eq("username", username).execute()
    if q.data:
        return q.data[0]
        
    res = supabase.table("users").insert({"username": username}).select("*").execute()
    
    if res.data:
        return res.data[0]
    
    st.error("Could not create or retrieve user. Check RLS policies.")
    return None


# --- Circles ---
def create_circle(name, owner_id):
    join_code = gen_code(6)
    circle_id = str(uuid.uuid4())
    supabase.table("circles").insert({
        "id": circle_id,
        "name": name,
        "join_code": join_code,
        "owner_id": owner_id
    }).execute()
    # add owner as member
    supabase.table("circle_members").insert({
        "circle_id": circle_id,
        "user_id": owner_id,
        "role": "owner"
    }).execute()
    return circle_id, join_code

def join_circle(join_code, user_id):
    q = supabase.table("circles").select("*").eq("join_code", join_code).execute()
    if not q.data:
        return None
    circle = q.data[0]
    # insert member (unique constraint prevents duplicates)
    supabase.table("circle_members").insert({
        "circle_id": circle["id"],
        "user_id": user_id,
        "role": "member"
    }).execute()
    return circle

def get_user_circles(user_id):
    mems = supabase.table("circle_members").select("*").eq("user_id", user_id).execute().data or []
    ids = [m["circle_id"] for m in mems]
    if not ids:
        return []
    circles = supabase.table("circles").select("*").in_("id", tuple(ids)).execute().data or []
    return circles

# --- Challenges ---
# --- Challenges ---
def add_challenge(circle_id, title, description, created_by): # <-- Corrected arguments
    supabase.table("challenges").insert({
        "circle_id": circle_id,
        "title": title,          # <-- Use 'title' instead of 'text'
        "description": description, # <-- Add description
    }).execute()

def list_challenges(circle_id):
    return supabase.table("challenges").select("*").eq("circle_id", circle_id).execute().data or []

# --- Embarrassing posts ---
def save_embarrassing(user_id, url):
    supabase.table("embarrassing_posts").insert({
        "user_id": user_id,
        "file_url": url
    }).execute()

def get_embarrassing_for_user(user_id):
    return supabase.table("embarrassing_posts").select("*").eq("user_id", user_id).execute().data or []

# --- Daily assignments (one per user per day) ---
def ensure_assignment_for_today(user_id, circle_id):
    date_str = now_date()
    q = supabase.table("daily_assignments").select("*").eq("user_id", user_id).eq("date", date_str).execute()
    if q.data:
        return q.data[0]
    # pick random challenge from circle
    chs = supabase.table("challenges").select("*").eq("circle_id", circle_id).execute().data or []
    if not chs:
        return None
    chosen = random.choice(chs)
    res = supabase.table("daily_assignments").insert({
        "user_id": user_id,
        "challenge_id": chosen["id"],
        "date": date_str,
        "status": "pending"
    }).execute()
    return res.data[0]

def submit_proof(user_id, file_url):
    date_str = now_date()
    supabase.table("daily_assignments").update({
        "proof_url": file_url,
        "status": "pending"
    }).eq("user_id", user_id).eq("date", date_str).execute()

# --- Voting & evaluation ---
def cast_vote(voter_id, assignment_id, approve):
    # prevent duplicate votes by same voter: delete previous then insert (simple)
    supabase.table("votes").delete().eq("assignment_id", assignment_id).eq("voter_id", voter_id).execute()
    supabase.table("votes").insert({
        "assignment_id": assignment_id,
        "voter_id": voter_id,
        "approve": approve
    }).execute()
    evaluate_assignment(assignment_id)

def evaluate_assignment(assignment_id):
    # fetch assignment
    aq = supabase.table("daily_assignments").select("*").eq("id", assignment_id).execute().data
    if not aq:
        return
    a = aq[0]
    # find circle members (assume user is in at least one circle; pick first)
    mem = supabase.table("circle_members").select("*").eq("user_id", a["user_id"]).execute().data or []
    if not mem:
        # no circle members => auto approve
        supabase.table("daily_assignments").update({"status": "approved"}).eq("id", assignment_id).execute()
        return
    circle_id = mem[0]["circle_id"]
    members = supabase.table("circle_members").select("*").eq("circle_id", circle_id).execute().data or []
    total_voters = max(0, len(members) - 1)  # excluding owner of assignment
    votes = supabase.table("votes").select("*").eq("assignment_id", assignment_id).execute().data or []
    approvals = sum(1 for v in votes if v.get("approve"))
    rejects = sum(1 for v in votes if not v.get("approve"))

    if total_voters == 0:
        supabase.table("daily_assignments").update({"status": "approved"}).eq("id", assignment_id).execute()
        return

    # majority rule: approvals > total_voters/2 => approved
    if approvals > (total_voters / 2):
        supabase.table("daily_assignments").update({"status": "approved"}).eq("id", assignment_id).execute()
    # if rejects >= ceil(total_voters/2) maybe reject — but for demo: any single reject triggers rejected
    elif rejects >= 1:
        supabase.table("daily_assignments").update({"status": "rejected"}).eq("id", assignment_id).execute()
    # else stay pending until more votes

# --- Shame logic (run on app open) ---
def run_shame_check_for_yesterday():
    yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    assigns = supabase.table("daily_assignments").select("*").eq("date", yesterday).execute().data or []
    for a in assigns:
        status = a.get("status") or "pending"
        if status in ("pending", "rejected"):
            supabase.table("daily_assignments").update({"status": "shame"}).eq("id", a["id"]).execute()

def list_shame_last_24h():
    shames = supabase.table("daily_assignments").select("*").eq("status", "shame").execute().data or []
    items = []
    for s in shames:
        posts = supabase.table("embarrassing_posts").select("*").eq("user_id", s["user_id"]).execute().data or []
        if not posts:
            continue
        pick = random.choice(posts)
        userrow = supabase.table("users").select("*").eq("id", s["user_id"]).execute().data or []
        uname = userrow[0]["username"] if userrow else s["user_id"][:8]
        items.append({"username": uname, "file_url": pick["file_url"], "date": s["date"]})
    return items


# UI
st.set_page_config(page_title="Plot", layout="wide")
st.title("For the Plot")

# session user object: {"id","username"}
if "user" not in st.session_state:
    st.session_state.user = None

# --- LOGIN / SIGNUP (username only) ---
if st.session_state.user is None:
    st.subheader("Sign in / Sign up (username only)")
    username = st.text_input("Pick a username", key="login_username")
    if st.button("Start"):
        if not username.strip():
            st.error("Enter a username")
        else:
            user = create_or_get_user(username)
            st.session_state.user = user
            st.success(f"Welcome, {user['username']}!")
            st.rerun()
    st.stop()

user = st.session_state.user
st.sidebar.success(f"Signed in as: {user['username']}")
if st.sidebar.button("Logout"):
    st.session_state.user = None
    st.rerun()

# run shame conversion for yesterday
run_shame_check_for_yesterday()

# Sidebar actions
mode = st.sidebar.radio("Menu", ["My Circles", "Create Circle", "Join Circle", "Circle View", "Public Shame"])

# ---- Create Circle ----
if mode == "Create Circle":
    st.header("Create a new Plot Circle")
    circle_name = st.text_input("Circle name")
    if st.button("Create"):
        if not circle_name.strip():
            st.error("Name it!")
        else:
            cid, code = create_circle(circle_name, user["id"])
            st.success(f"Circle '{circle_name}' created. Share this code with friends: `{code}`")

# ---- Join Circle ----
elif mode == "Join Circle":
    st.header("Join a Circle with a code")
    join_code = st.text_input("Enter code")
    if st.button("Join"):
        if not join_code.strip():
            st.error("Enter code")
        else:
            circle = join_circle(join_code.strip(), user["id"])
            if circle:
                st.success(f"Joined circle: {circle['name']}")
            else:
                st.error("Invalid code")

# ---- My Circles ----
elif mode == "My Circles":
    st.header("Your Circles")
    circles = get_user_circles(user["id"])
    if not circles:
        st.info("You are not in any circles yet. Create or join one.")
    else:
        for c in circles:
            st.markdown(f"### {c['name']}  —  Code: `{c['join_code']}`")
            # members
            mems = supabase.table("circle_members").select("*").eq("circle_id", c["id"]).execute().data or []
            member_ids = [m["user_id"] for m in mems]
            users_rows = supabase.table("users").select("*").in_("id", tuple(member_ids)).execute().data or []
            st.write("Members:")
            for u in users_rows:
                st.write("-", u["username"])
            st.write("---")

# ---- Circle View (enter circle id or select) ----
elif mode == "Circle View":
    st.header("Circle Dashboard")
    # choose a circle you're in
    circles = get_user_circles(user["id"])
    if not circles:
        st.info("No circles yet.")
    else:
        choices = {c["name"]: c for c in circles}
        pick = st.selectbox("Pick a circle", list(choices.keys()))
        circle = choices[pick]
        st.subheader(f"{circle['name']} (Code: `{circle['join_code']}`)")

        # Upload embarrassing posts if none exist
        existing = get_embarrassing_for_user(user["id"])
        if not existing:
            st.info("Upload up to 3 embarrassing posts (these reveal if you fail).")
            files = st.file_uploader("Upload (images/videos)", accept_multiple_files=True, key="emb_upload")
            if st.button("Save embarrassing posts"):
                if not files:
                    st.error("Choose files")
                else:
                    for f in files[:3]:
                        url = upload_to_bucket("embarrassing_posts", f, prefix=f"{user['id']}_")
                        save_embarrassing(user["id"], url)
                    st.success("Saved!")

        else:
            st.write(f"You have {len(existing)} embarrassing posts saved.")

        st.markdown("---")
        # Challenges list & add
        st.subheader("Challenges")
        chs = list_challenges(circle["id"])
        for ch in chs:
            # This line now works because we insert 'title' and 'description'
            st.write(f"- **{ch['title']}** — {ch.get('description','')}")
        st.write("Add a new challenge")
        t = st.text_input("Title", key="ch_title")
        d = st.text_area("Description (optional)", key="ch_desc")
        if st.button("Add challenge"):
            if not t.strip():
                st.error("Enter title")
            else:
                # This call now correctly matches the function definition
                add_challenge(circle["id"], t.strip(), d.strip(), user["id"])
                st.success("Added challenge")
                st.rerun()

        st.markdown("---")
        # Today's assignment for this user
        st.subheader("Your daily challenge (for this circle)")
        assignment = ensure_assignment_for_today(user["id"], circle["id"])
        if not assignment:
            st.info("No challenges exist in this circle yet.")
        else:
            chrow = supabase.table("challenges").select("*").eq("id", assignment["challenge_id"]).execute().data[0]
            st.write("**Today's challenge:**", chrow["title"])
            if chrow.get("description"):
                st.write(chrow["description"])
            st.write("Status:", assignment.get("status", "pending"))
            if assignment.get("proof_url"):
                st.write("You submitted proof:")
                st.image(assignment["proof_url"])
            else:
                proof = st.file_uploader("Upload proof for today's challenge", key=f"proof_{circle['id']}")
                if st.button("Submit proof"):
                    if not proof:
                        st.error("Choose a proof file")
                    else:
                        url = upload_to_bucket("proofs", proof, prefix=f"{user['id']}_")
                        submit_proof(user["id"], url)
                        st.success("Proof submitted and awaiting votes")

        st.markdown("---")
        # Voting on other members' proofs
        st.subheader("Vote on friends' proofs (today)")
        mems = supabase.table("circle_members").select("*").eq("circle_id", circle["id"]).execute().data or []
        other_ids = [m["user_id"] for m in mems if m["user_id"] != user["id"]]
        if not other_ids:
            st.info("No other members to vote on.")
        else:
            for oid in other_ids:
                urow = supabase.table("users").select("*").eq("id", oid).execute().data or []
                label = urow[0]["username"] if urow else oid[:8]
                a = supabase.table("daily_assignments").select("*").eq("user_id", oid).eq("date", now_date()).execute().data or []
                if not a:
                    st.write(f"- {label}: no assignment yet")
                    continue
                a = a[0]
                status = a.get("status", "pending")
                if a.get("proof_url") and status == "pending":
                    st.write(f"Proof from **{label}**:")
                    st.image(a["proof_url"])
                    c1, c2 = st.columns(2)
                    with c1:
                        if st.button(f"Approve {label}", key=f"ap_{a['id']}"):
                            cast_vote(user["id"], a["id"], True)
                            st.success("Voted approve")
                    with c2:
                        if st.button(f"Reject {label}", key=f"rj_{a['id']}"):
                            cast_vote(user["id"], a["id"], False)
                            st.success("Voted reject")
                else:
                    st.write(f"- {label}: {status}")

# ---- Public Shame ----
elif mode == "Public Shame":
    st.header("Public Shame — last 24 hours")
    items = list_shame_last_24h()
    if not items:
        st.write("No public shames in the last 24 hours.")
    else:
        for it in items:
            st.write(f"**{it['username']}** failed on {it['date']}")
            st.image(it["file_url"], use_column_width=True)
            st.markdown(f"[Download image]({it['file_url']})")

