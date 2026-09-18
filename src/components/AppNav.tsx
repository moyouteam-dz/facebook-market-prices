import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "الرئيسية" },
  { to: "/update", label: "التحديث" },
  { to: "/history", label: "السجل" },
  { to: "/settings", label: "الإعدادات" },
];

export default function AppNav() {
  return (
    <nav className="bottom-nav" aria-label="التنقل الرئيسي">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) => (isActive ? "active" : undefined)}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
