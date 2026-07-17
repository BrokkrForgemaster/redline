"use client";

interface Props {
  password: string;
}

function getStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 3) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score <= 4) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-lawn" };
}

export default function PasswordStrength({ password }: Props) {
  const { score, label, color } = getStrength(password);
  if (!password) return null;

  const bars = [1, 2, 3, 4, 5, 6];

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {bars.map((bar) => (
          <div
            key={bar}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
              bar <= score ? color : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      {label && (
        <p className={`mt-1 text-xs font-medium ${
          label === "Weak" ? "text-red-600" :
          label === "Fair" ? "text-yellow-600" :
          label === "Good" ? "text-blue-600" :
          "text-lawn"
        }`}>
          {label} password
          {label === "Weak" && " — use 12+ characters with mixed case, numbers, and symbols"}
        </p>
      )}
    </div>
  );
}
