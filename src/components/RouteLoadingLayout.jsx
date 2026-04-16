import { useEffect, useState } from "react";
import { Outlet, useNavigation } from "react-router-dom";
import logoImg from "../assets/logo.png";
import "./RouteLoadingLayout.css";

export default function RouteLoadingLayout() {
  const navigation = useNavigation();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showStart, setShowStart] = useState(0);

  useEffect(() => {
    let showTimer;
    let hideTimer;
    let unmountTimer;

    if (navigation.state === "loading") {
      showTimer = window.setTimeout(() => {
        setMounted(true);
        setVisible(true);
        setShowStart(Date.now());
      }, 120);
    } else if (mounted) {
      const elapsed = Date.now() - showStart;
      const minVisible = 700;
      const remaining = Math.max(0, minVisible - elapsed);

      hideTimer = window.setTimeout(() => setVisible(false), remaining);
      unmountTimer = window.setTimeout(() => setMounted(false), remaining + 220);
    }

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [navigation.state, mounted, showStart]);

  return (
    <>
      {mounted && (
        <div className={`route-loader-overlay ${visible ? "route-loader-visible" : "route-loader-hidden"}`}>
          <div className="route-loader-card">
            <div className="loading-header">
              <img src={logoImg} alt="Lathala logo" className="loading-logo" />
              <div className="loading-title-block">
                <div className="loading-title">Lathala</div>
                <span className="loading-subtitle">Loading your next page</span>
              </div>
            </div>
            <div className="loading-spinner" />
          </div>
        </div>
      )}
      <Outlet />
    </>
  );
}
