const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage
let tasks = [];
let dependencies = [];
let taskIdCounter = 1;

// ------------------- AI Algorithm Logic -------------------

// Build a directed graph from tasks and their dependencies
function buildGraph(tasks, dependencies) {
  const graph = {};
  
  // Initialize graph with all tasks
  tasks.forEach(task => {
    graph[task.id] = [];
  });
  
  // Add edges for dependencies
  dependencies.forEach(dep => {
    // If task A depends on task B, we add an edge from B to A
    // This means B must be completed before A can start
    if (graph[dep.dependsOn]) {
      graph[dep.dependsOn].push(dep.taskId);
    }
  });
  
  return graph;
}

// Calculate in-degree for each node
function calculateInDegree(graph) {
  const inDegree = {};
  
  // Initialize all in-degrees to 0
  for (const node in graph) {
    inDegree[node] = 0;
  }
  
  // Count incoming edges
  for (const node in graph) {
    for (const neighbor of graph[node]) {
      inDegree[neighbor] = (inDegree[neighbor] || 0) + 1;
    }
  }
  
  return inDegree;
}

// Topological Sort (Kahn's algorithm)
function topologicalSort(tasks, dependencies) {
  const graph = buildGraph(tasks, dependencies);
  const inDegree = calculateInDegree(graph);
  const queue = [];
  const result = [];
  
  // Add all nodes with in-degree 0 to queue
  for (const node in inDegree) {
    if (inDegree[node] === 0) {
      queue.push(parseInt(node));
    }
  }
  
  // Process the queue
  while (queue.length > 0) {
    const current = queue.shift();
    result.push(current);
    
    // Decrease in-degree of neighbors
    if (graph[current]) {
      for (const neighbor of graph[current]) {
        inDegree[neighbor]--;
        
        // If in-degree becomes 0, add to queue
        if (inDegree[neighbor] === 0) {
          queue.push(parseInt(neighbor));
        }
      }
    }
  }
  
  // Check if there's a cycle
  if (result.length !== Object.keys(inDegree).length) {
    return { hasCycle: true, order: [] };
  }
  
  return { hasCycle: false, order: result };
}

// DFS algorithm for scheduling
function dfs(graph, start, visited = {}, result = []) {
  visited[start] = true;
  result.push(parseInt(start));
  
  if (graph[start]) {
    for (const neighbor of graph[start]) {
      if (!visited[neighbor]) {
        dfs(graph, neighbor, visited, result);
      }
    }
  }
  
  return result;
}

// Performs DFS traversal on entire graph, handling disconnected components
function dfsTraversal(tasks, dependencies) {
  const graph = buildGraph(tasks, dependencies);
  const visited = {};
  const result = [];
  
  // Find root nodes (tasks with no dependencies)
  const inDegree = calculateInDegree(graph);
  const rootNodes = [];
  
  for (const node in inDegree) {
    if (inDegree[node] === 0) {
      rootNodes.push(parseInt(node));
    }
  }
  
  // If no root nodes found (cycle), start with any node
  const startNodes = rootNodes.length > 0 ? rootNodes : Object.keys(graph).map(Number);
  
  // Run DFS from each start node
  for (const startNode of startNodes) {
    if (!visited[startNode]) {
      dfs(graph, startNode, visited, result);
    }
  }
  
  return result;
}

// BFS algorithm for scheduling
function bfs(tasks, dependencies) {
  const graph = buildGraph(tasks, dependencies);
  const visited = {};
  const result = [];
  
  // Find root nodes (tasks with no dependencies)
  const inDegree = calculateInDegree(graph);
  const rootNodes = [];
  
  for (const node in inDegree) {
    if (inDegree[node] === 0) {
      rootNodes.push(parseInt(node));
    }
  }
  
  // If no root nodes found (cycle), start with any node
  const startNodes = rootNodes.length > 0 ? rootNodes : Object.keys(graph).map(Number);
  
  // Run BFS from each start node
  for (const startNode of startNodes) {
    if (!visited[startNode]) {
      const queue = [startNode];
      visited[startNode] = true;
      
      while (queue.length > 0) {
        const current = queue.shift();
        result.push(current);
        
        if (graph[current]) {
          for (const neighbor of graph[current]) {
            if (!visited[neighbor]) {
              visited[neighbor] = true;
              queue.push(parseInt(neighbor));
            }
          }
        }
      }
    }
  }
  
  return result;
}

// A* search algorithm for task scheduling
function aStarSearch(tasks, dependencies) {
  const graph = buildGraph(tasks, dependencies);
  const priorityValues = { 'High': 3, 'Medium': 2, 'Low': 1 };
  
  // Cost function: combination of priority and estimated time
  function calculateCost(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return Infinity;
    
    // Lower time and higher priority = lower cost (higher preference)
    return (1000 / (priorityValues[task.priority] || 0)) + (task.estimated_time / 10);
  }
  
  const visited = {};
  const result = [];
  
  // Find root nodes (tasks with no dependencies)
  const inDegree = calculateInDegree(graph);
  const rootNodes = [];
  
  for (const node in inDegree) {
    if (inDegree[node] === 0) {
      rootNodes.push(parseInt(node));
    }
  }
  
  // Priority queue implementation (using array + sort)
  const queue = rootNodes.map(id => ({ id, cost: calculateCost(id) }));
  
  while (queue.length > 0) {
    // Sort by cost and get the lowest cost task
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift().id;
    
    if (visited[current]) continue;
    
    visited[current] = true;
    result.push(current);
    
    // Add neighbors to queue
    if (graph[current]) {
      for (const neighbor of graph[current]) {
        if (!visited[neighbor]) {
          queue.push({ id: parseInt(neighbor), cost: calculateCost(neighbor) });
        }
      }
    }
  }
  
  // Process any remaining nodes (disconnected components)
  for (const task of tasks) {
    if (!visited[task.id]) {
      result.push(task.id);
    }
  }
  
  return result;
}

// ------------------- Routes -------------------

// Add new task
app.post("/tasks", (req, res) => {
  const { name, estimated_time, status, priority, dependencies: taskDependencies } = req.body;
  
  const newTask = {
    id: taskIdCounter++,
    name,
    estimated_time: parseInt(estimated_time),
    status,
    priority
  };
  
  tasks.push(newTask);
  
  // Add dependencies if any
  if (taskDependencies && Array.isArray(taskDependencies)) {
    taskDependencies.forEach(depTaskId => {
      // The new task depends on depTaskId
      dependencies.push({
        taskId: newTask.id,
        dependsOn: parseInt(depTaskId)
      });
    });
  }
  
  res.status(201).json({ 
    message: "Task added successfully!", 
    taskId: newTask.id 
  });
});

// Get all tasks
app.get("/tasks", (req, res) => {
  const { sort } = req.query;
  let sortedTasks = [...tasks];
  
  if (sort === "priority") {
    const priorityRank = { 'High': 1, 'Medium': 2, 'Low': 3 };
    sortedTasks.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
  } else if (sort === "estimated_time") {
    sortedTasks.sort((a, b) => a.estimated_time - b.estimated_time);
  }
  
  res.json(sortedTasks);
});

// Get task dependencies
app.get("/dependencies", (req, res) => {
  res.json(dependencies);
});

// Get sorted tasks based on selected algorithm
app.get("/tasks/sorted/:algorithm", (req, res) => {
  const { algorithm } = req.params;
  let sortedIds = [];
  let sortInfo = {};
  
  try {
    if (algorithm === "topological") {
      const result = topologicalSort(tasks, dependencies);
      sortedIds = result.order;
      sortInfo = { 
        algorithm: "Topological Sort",
        hasCycle: result.hasCycle,
        description: "Sorts tasks based on their dependencies in a way that no task is processed before its dependencies"
      };
    } else if (algorithm === "dfs") {
      sortedIds = dfsTraversal(tasks, dependencies);
      sortInfo = {
        algorithm: "Depth-First Search",
        description: "Explores tasks along each branch to its full depth before backtracking"
      };
    } else if (algorithm === "bfs") {
      sortedIds = bfs(tasks, dependencies);
      sortInfo = {
        algorithm: "Breadth-First Search",
        description: "Explores all neighbor tasks before moving to the next level of neighbors"
      };
    } else if (algorithm === "astar") {
      sortedIds = aStarSearch(tasks, dependencies);
      sortInfo = {
        algorithm: "A* Search",
        description: "Uses task priority and time as heuristics to find optimal task ordering"
      };
    }
    
    // Map IDs back to task objects
    const sortedTasks = sortedIds.map(id => tasks.find(task => task.id === id)).filter(Boolean);
    
    res.json({
      tasks: sortedTasks,
      sortInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark a task as done
app.put("/tasks/:id/done", (req, res) => {
  const taskId = parseInt(req.params.id);
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  
  if (taskIndex !== -1) {
    tasks[taskIndex].status = 'Done';
    res.json({ message: "Task marked as done!" });
  } else {
    res.status(404).json({ error: "Task not found" });
  }
});

// Delete task
app.delete("/tasks/:id", (req, res) => {
  const taskId = parseInt(req.params.id);
  tasks = tasks.filter(t => t.id !== taskId);
  
  // Remove dependencies related to this task
  dependencies = dependencies.filter(
    d => d.taskId !== taskId && d.dependsOn !== taskId
  );
  
  res.json({ message: "Task deleted successfully." });
});

// Add dependency between tasks
app.post("/dependencies", (req, res) => {
  const { taskId, dependsOn } = req.body;
  
  // Validate task IDs
  const taskExists = tasks.some(t => t.id === parseInt(taskId));
  const dependsOnExists = tasks.some(t => t.id === parseInt(dependsOn));
  
  if (!taskExists || !dependsOnExists) {
    return res.status(400).json({ error: "Invalid task IDs" });
  }
  
  // Check for cycles
  const tempDependencies = [...dependencies, { taskId: parseInt(taskId), dependsOn: parseInt(dependsOn) }];
  const { hasCycle } = topologicalSort(tasks, tempDependencies);
  
  if (hasCycle) {
    return res.status(400).json({ error: "Adding this dependency would create a cycle" });
  }
  
  dependencies.push({ 
    taskId: parseInt(taskId), 
    dependsOn: parseInt(dependsOn)
  });
  
  res.status(201).json({ message: "Dependency added successfully" });
});

// Delete dependency
app.delete("/dependencies", (req, res) => {
  const { taskId, dependsOn } = req.query;
  
  dependencies = dependencies.filter(
    d => !(d.taskId === parseInt(taskId) && d.dependsOn === parseInt(dependsOn))
  );
  
  res.json({ message: "Dependency removed successfully" });
});

// Start server
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});