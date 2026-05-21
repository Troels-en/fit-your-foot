import React from 'react';

interface SlideLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const SlideLayout: React.FC<SlideLayoutProps> = ({ children, className = '' }) => {
  return (
    <div className={`w-full h-full flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 ${className}`}>
      {children}
    </div>
  );
};

export default SlideLayout;
