using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace myFirstApp.Models
{
    public class Todo
    {
        public int Id { get; set; }
        public String Text { get; set; }
        public int Priority { get; set; }
        public DateTime? DueDate { get; set; }
    }
}