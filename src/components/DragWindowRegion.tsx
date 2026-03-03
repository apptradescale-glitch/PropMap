import { closeWindow, maximizeWindow, minimizeWindow } from "@/helpers/window_helpers";
import { LayoutDashboard } from "lucide-react";
import React, { type ReactNode } from "react";
import Logo from '@/assets/images/lg34.png';

interface DragWindowRegionProps {
    title?: ReactNode;
}

export default function DragWindowRegion({ title }: DragWindowRegionProps) {
    return (
        <div className="flex w-screen items-stretch justify-between">
            <div className="draglayer w-full">
                {title && (
                    <div className="flex flex-1 select-none whitespace-nowrap p-2 text-xs text-white font-bold bg-primary">
                       <img src={Logo} className="mr-2 h-4 w-4" alt="Logo" />
                        {title}
                    </div>
                )}
            </div>
           
        </div>
    );
}

function WindowButtons() {
    return (
        <div className="flex bg-primary">
            <button
                title="Minimize"
                type="button"
                className="p-2 text-white hover:bg-slate-500 dark:hover:bg-slate-700"
                onClick={minimizeWindow}
            >
                <svg aria-hidden="true" role="img" width="12" height="12" viewBox="0 0 12 12">
                    <rect fill="currentColor" width="10" height="1" x="1" y="6"></rect>
                </svg>
            </button>
            <button
                title="Maximize"
                type="button"
                className="p-2 text-white hover:bg-slate-500 dark:hover:bg-slate-700"
                onClick={maximizeWindow}
            >
                <svg aria-hidden="true" role="img" width="12" height="12" viewBox="0 0 12 12">
                    <rect
                        width="9"
                        height="9"
                        x="1.5"
                        y="1.5"
                        fill="none"
                        stroke="currentColor"
                    ></rect>
                </svg>
            </button>
            <button
                type="button"
                title="Close"
                className="p-2 text-white hover:bg-red-700"
                onClick={closeWindow}
            >
                <svg aria-hidden="true" role="img" width="12" height="12" viewBox="0 0 12 12">
                    <polygon
                        fill="currentColor"
                        fillRule="evenodd"
                        points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"
                    ></polygon>
                </svg>
            </button>
        </div>
    );
}
