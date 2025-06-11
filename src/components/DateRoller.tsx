
import React, { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateRollerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  className?: string;
}

const DateRoller: React.FC<DateRollerProps> = ({ 
  value, 
  onChange, 
  placeholder = "Pick a date",
  className 
}) => {
  const [selectedDay, setSelectedDay] = useState(value?.getDate() || 1);
  const [selectedMonth, setSelectedMonth] = useState(value?.getMonth() || 0);
  const [selectedYear, setSelectedYear] = useState(value?.getFullYear() || new Date().getFullYear());
  const [isOpen, setIsOpen] = useState(false);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  useEffect(() => {
    if (value) {
      setSelectedDay(value.getDate());
      setSelectedMonth(value.getMonth());
      setSelectedYear(value.getFullYear());
    }
  }, [value]);

  const handleDateSelection = () => {
    const newDate = new Date(selectedYear, selectedMonth, selectedDay);
    onChange(newDate);
    setIsOpen(false);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const RollerColumn = ({ 
    items, 
    selectedValue, 
    onSelect, 
    renderItem 
  }: {
    items: any[];
    selectedValue: any;
    onSelect: (value: any) => void;
    renderItem: (item: any) => string;
  }) => (
    <ScrollArea className="h-40 w-full">
      <div className="flex flex-col">
        {items.map((item) => (
          <button
            key={item}
            onClick={() => onSelect(item)}
            className={cn(
              "p-2 text-center text-sm hover:bg-accent transition-colors",
              selectedValue === item && "bg-primary text-primary-foreground font-medium"
            )}
          >
            {renderItem(item)}
          </button>
        ))}
      </div>
    </ScrollArea>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-11 w-full justify-start text-left font-normal bg-background border-border",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatDate(value) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 z-50 bg-card border-border" align="start">
        <div className="p-4">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center">
              <h4 className="text-sm font-medium mb-2">Day</h4>
              <RollerColumn
                items={days}
                selectedValue={selectedDay}
                onSelect={setSelectedDay}
                renderItem={(day) => day.toString()}
              />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-medium mb-2">Month</h4>
              <RollerColumn
                items={months}
                selectedValue={months[selectedMonth]}
                onSelect={(month) => setSelectedMonth(months.indexOf(month))}
                renderItem={(month) => month}
              />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-medium mb-2">Year</h4>
              <RollerColumn
                items={years}
                selectedValue={selectedYear}
                onSelect={setSelectedYear}
                renderItem={(year) => year.toString()}
              />
            </div>
          </div>
          <Button 
            onClick={handleDateSelection}
            className="w-full"
          >
            Select Date
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateRoller;
