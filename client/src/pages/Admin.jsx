import { Link, Outlet, useLocation } from "react-router-dom";

export default function Admin() {
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    return (
        <div style={{ padding: "40px" }}>
            {/* Niche navbar - sirf yahan */}
            <div style={{ ...styles.navContainer, alignItems: "center" }}>
                <Link to="/" style={{ textDecoration: "none", marginRight: "auto" }}>
                    <img src="/SuperBrain_logo.png" alt="SuperBrain" style={{ height: 40, width: "auto", objectFit: "contain" }} />
                </Link>
                <Link to="/admin/users" style={{ textDecoration: "none" }}>
                    <button style={{
                        ...styles.navBtn,
                        backgroundColor: isActive("/admin/users") ? "#6366f1" : "#f1f5f9",
                        color: isActive("/admin/users") ? "white" : "#374151"
                    }}>
                        👥 Users
                    </button>
                </Link>

                <Link to="/admin/reels" style={{ textDecoration: "none" }}>
                    <button style={{
                        ...styles.navBtn,
                        backgroundColor: isActive("/admin/reels") ? "#6366f1" : "#f1f5f9",
                        color: isActive("/admin/reels") ? "white" : "#374151"
                    }}>
                        🎥 Reels
                    </button>
                </Link>

                <Link to="/admin/transcripts" style={{ textDecoration: "none" }}>
                    <button style={{
                        ...styles.navBtn,
                        backgroundColor: isActive("/admin/transcripts") ? "#6366f1" : "#f1f5f9",
                        color: isActive("/admin/transcripts") ? "white" : "#374151"
                    }}>
                        📝 Transcripts
                    </button>
                </Link>
            </div>

            <hr />

            {/* Content */}
            <Outlet />
        </div>
    );
}

const styles = {
    navContainer: {
        display: "flex",
        gap: 12,
        marginBottom: 24,
    },
    navBtn: {
        padding: "12px 24px",
        border: "2px solid #e2e8f0",
        borderRadius: 12,
        fontSize: 15,
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
    },
};
