import { useState, useEffect, useRef } from "react"
import micOn from "./assets/microphone-342.svg"
import micOff from "./assets/microphone-sound-off-14636.svg"

export default function Mic(){
    const [isMuted, setIsMuted] = useState(false);
    const streamRef = useRef(null)

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream;
      })
      .catch(err => {
        console.error("Microphone access denied:", err);
      });
  }, []);

 const handleToggle = () => {
    if (!streamRef.current) return;
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = isMuted;
    setIsMuted(prev => !prev);
  };
    return(
        <>
        <img
        src={isMuted ? micOff : micOn}
        alt="Mic"
        onClick={handleToggle}
        style={{cursor: "pointer"}}/>
        </>
    )
}