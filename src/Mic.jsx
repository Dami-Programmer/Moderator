import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function Mic() {
  const socket = useRef(); // store socket instance
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());

  const [status, setStatus] = useState("🔴 Not joined");
  const [users, setUsers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [joined, setJoined] = useState(false);

  // Initialize audio
  const initAudio = async () => {
    if (localStreamRef.current) return;
    localStreamRef.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
  };

  // Update user list
  const updateUsers = (updater) => {
    setUsers((prev) => {
      const set = new Set(prev);
      updater(set);
      return Array.from(set);
    });
  };

  // Create WebRTC peer
  const createPeer = (userId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    localStreamRef.current
      .getTracks()
      .forEach((track) => pc.addTrack(track, localStreamRef.current));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.current.emit("ice-candidate", {
          target: userId,
          candidate: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => {
      const audio = document.createElement("audio");
      audio.srcObject = e.streams[0];
      audio.autoplay = true;
      document.body.appendChild(audio);
    };

    peersRef.current.set(userId, pc);
    return pc;
  };

  // Initialize socket and attach all events
  useEffect(() => {
    const s = io("http://localhost:3001"); // create socket once
    socket.current = s;

    s.on("connect", () => console.log("Connected:", s.id));
    s.on("disconnect", () => console.log("Disconnected:", s.id));

    s.on("joined-room", ({ roomId, userId }) => {
      setStatus(`🟢 Joined ${roomId}`);
      updateUsers((set) => set.add(userId));
      setJoined(true);
    });

    s.on("user-joined", async (userId) => {
      updateUsers((set) => set.add(userId));

      const pc = createPeer(userId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      s.emit("offer", { target: userId, offer });
    });

    s.on("offer", async ({ from, offer }) => {
      updateUsers((set) => set.add(from));

      const pc = createPeer(from);
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      s.emit("answer", { target: from, answer });
    });

    s.on("answer", async ({ from, answer }) => {
      const pc = peersRef.current.get(from);
      if (pc) await pc.setRemoteDescription(answer);
    });

    s.on("ice-candidate", ({ from, candidate }) => {
      peersRef.current.get(from)?.addIceCandidate(candidate);
    });

    s.on("user-left", (userId) => {
      updateUsers((set) => set.delete(userId));
      peersRef.current.get(userId)?.close();
      peersRef.current.delete(userId);
    });

    return () => s.disconnect(); // cleanup on unmount
  }, []);

  // Join room
  const joinRoom = async () => {
    await initAudio();
    socket.current.emit("join-room", "voice-room-1");
  };

  // Mute/unmute
  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;

    track.enabled = isMuted;
    setIsMuted(!isMuted);
  };

  // UI
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2>🎤 Voice Chat</h2>

        <div style={styles.controls}>
          <button onClick={joinRoom} disabled={joined} style={styles.join}>
            Join Room
          </button>

          <button
            onClick={toggleMute}
            disabled={!joined}
            style={{
              ...styles.mute,
              background: isMuted ? "#22c55e" : "#ef4444",
            }}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
        </div>

        <div style={styles.status}>{status}</div>

        <div>
          <h4>Users in room</h4>
          <ul style={styles.list}>
            {users.map((id) => (
              <li
                key={id}
                style={{
                  ...styles.user,
                  background: id === socket.current?.id ? "#05f75a" : "#f1f5f9",
                }}
              >
                {id === socket.current?.id ? `${id} (You)` : id}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------- STYLES ---------- */
const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f7fa",
    padding: 16,
  },
  card: {
    background: "#fff",
    maxWidth: 420,
    width: "100%",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 10px 25px rgba(0,0,0,.08)",
  },
  controls: {
    display: "flex",
    gap: 10,
    marginBottom: 15,
  },
  join: {
    flex: 1,
    padding: 12,
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
  },
  mute: {
    flex: 1,
    padding: 12,
    color: "#fff",
    border: "none",
    borderRadius: 8,
  },
  status: {
    textAlign: "center",
    fontWeight: 600,
    marginBottom: 15,
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  user: {
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    fontSize: 14,
    wordBreak: "break-all",
  },
};
