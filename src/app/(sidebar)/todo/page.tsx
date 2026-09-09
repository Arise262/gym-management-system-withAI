'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'

// Define the Todo interface
interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

const TodoPage: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load todos from localStorage on component mount
  useEffect(() => {
    const storedTodos = localStorage.getItem('todos');
    if (storedTodos) {
      try {
        // Parse the stored todos and ensure dates are properly converted back to Date objects
        const parsedTodos = JSON.parse(storedTodos).map((todo: any) => ({
          ...todo,
          createdAt: new Date(todo.createdAt)
        }));
        setTodos(parsedTodos);
      } catch (error) {
        console.error('Failed to parse todos from localStorage:', error);
        
        toast.error("There was a problem loading your saved todos.");
      }
    }
    setIsLoading(false);
  }, []);

  // Save todos to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('todos', JSON.stringify(todos));
    }
  }, [todos, isLoading]);

  // Add a new todo
  const addTodo = () => {
    if (newTodo.trim() === '') {
      
      toast.error("Please enter a task before adding.");
      return;
    }

    const newTodoItem: Todo = {
      id: crypto.randomUUID(),
      text: newTodo,
      completed: false,
      createdAt: new Date()
    };

    setTodos(prevTodos => [newTodoItem, ...prevTodos]);
    setNewTodo('');
    
   
    toast.success("Task added successfully")
  };

  // Handle pressing Enter key in input field
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addTodo();
    }
  };

  // Toggle todo completion status
  const toggleTodo = (id: string) => {
    setTodos(prevTodos =>
      prevTodos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  // Delete a todo
  const deleteTodo = (id: string) => {
    setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id));
    
    
    toast.success("Task deleted successfully")
  };

  // Clear all completed todos
  const clearCompleted = () => {
    setTodos(prevTodos => prevTodos.filter(todo => !todo.completed));
    
    toast.success("Completed tasks cleared")
  };

  // Group todos by completion status
  const incompleteTodos = todos.filter(todo => !todo.completed);
  const completedTodos = todos.filter(todo => todo.completed);

  return (
    <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-semibold'>To Do</h1>
      </div>
      <Separator />

      
      {/* Add new todo */}
      <div className="flex gap-2 mb-8">
        <Input
          placeholder="Add a new task..."
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-grow"
        />
        <Button onClick={addTodo}>Add</Button>
      </div>
      
      {/* Todo statistics */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-muted-foreground">
          {incompleteTodos.length} tasks remaining
        </div>
        {completedTodos.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                Clear completed
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear completed tasks?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all completed tasks. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearCompleted}>
                  Clear
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      
      {/* Todo list */}
      {isLoading ? (
        <div className="flex justify-center my-10">
          <p>Loading todos...</p>
        </div>
      ) : todos.length === 0 ? (
        <div className="text-center my-10 py-8 border border-dashed rounded-lg">
          <p className="text-muted-foreground">No tasks yet. Add one above!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active todos */}
          {incompleteTodos.map(todo => (
            <TodoItem 
              key={todo.id} 
              todo={todo} 
              toggleTodo={toggleTodo} 
              deleteTodo={deleteTodo} 
            />
          ))}
          
          {/* Completed todos */}
          {completedTodos.length > 0 && (
            <>
              <h2 className="text-lg font-medium mt-8 mb-3 text-muted-foreground">
                Completed
              </h2>
              {completedTodos.map(todo => (
                <TodoItem 
                  key={todo.id} 
                  todo={todo} 
                  toggleTodo={toggleTodo} 
                  deleteTodo={deleteTodo} 
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// TodoItem component
interface TodoItemProps {
  todo: Todo;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, toggleTodo, deleteTodo }) => {
  return (
    <Card className={`transition-all ${todo.completed ? 'bg-muted/50' : ''}`}>
      <CardContent className="">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-grow">
            <Switch 
              checked={todo.completed}
              onCheckedChange={() => toggleTodo(todo.id)}
              aria-label={`Mark "${todo.text}" as ${todo.completed ? 'incomplete' : 'complete'}`}
            />
            <Label 
              className={`flex-grow ${todo.completed ? 'line-through text-muted-foreground' : ''}`}
              htmlFor={todo.id}
            >
              {todo.text}
            </Label>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                <Trash2 size={18} />
                <span className="sr-only">Delete</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete task?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove "{todo.text}". This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteTodo(todo.id)}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        
        <div className="text-xs text-muted-foreground mt-2">
          Added: {todo.createdAt.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" })} at {todo.createdAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}
        </div>
      </CardContent>
    </Card>
  );
};

export default TodoPage;